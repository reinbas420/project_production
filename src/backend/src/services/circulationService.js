const Issue = require("../models/Issue");
const BookCopy = require("../models/BookCopy");
const User = require("../models/User");
const LibraryBranch = require("../models/LibraryBranch");
const Delivery = require("../models/Delivery");
const AppError = require("../utils/AppError");
const { isWithinDeliveryRadius } = require("../utils/haversine");
const { calculateDueDate } = require("../utils/fineCalculator");
const inventoryService = require("./inventoryService");
const config = require("../config");
const mongoose = require("mongoose");

/**
 * Issue a book (with delivery eligibility check)
 */
exports.issueBook = async (issueData) => {
  const { userId, profileId, bookId, branchId, type = "PHYSICAL" } = issueData;

  // Start transaction for atomic operations
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Validate user and profile
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const profile = user.profiles.find(
      (p) => p.profileId.toString() === profileId.toString(),
    );
    if (!profile) {
      throw new AppError("Profile not found", 404);
    }

    // 2. Get library branch
    const branch = await LibraryBranch.findById(branchId).session(session);
    if (!branch || branch.status !== "ACTIVE") {
      throw new AppError("Library branch not found or inactive", 404);
    }

    // Resolve delivery location (needed for eligibility check and delivery record)
    const activeAddress =
      user.deliveryAddresses?.find((a) => a.isDefault) ||
      user.deliveryAddresses?.[0] ||
      user.deliveryAddress;

    // 3. Delivery Eligibility Check (Haversine Logic)
    if (type === "PHYSICAL") {
      if (
        !activeAddress?.location?.coordinates ||
        activeAddress.location.coordinates.length < 2
      ) {
        throw new AppError("Please set your delivery address first", 400);
      }

      if (
        !branch.location ||
        !branch.location.coordinates ||
        branch.location.coordinates.length < 2
      ) {
        throw new AppError(
          "Library branch does not have a valid location configured",
          400,
        );
      }

      const userLocation = {
        latitude: activeAddress.location.coordinates[1],
        longitude: activeAddress.location.coordinates[0],
      };

      const branchLocation = {
        latitude: branch.location.coordinates[1],
        longitude: branch.location.coordinates[0],
      };

      const isEligible = isWithinDeliveryRadius(
        userLocation,
        branchLocation,
        config.business.deliveryRadiusKm,
      );

      if (!isEligible) {
        throw new AppError(
          `Delivery not available. Library is beyond ${config.business.deliveryRadiusKm}km radius`,
          400,
        );
      }
    }

    // 4. Find available book copy
    const availableCopies = await inventoryService.getAvailableCopies(
      bookId,
      branchId,
      session,
    );

    if (availableCopies.length === 0) {
      throw new AppError("No copies available at this branch", 400);
    }

    const copy = availableCopies[0];

    // 5. Mark copy as issued
    await inventoryService.markAsIssued(copy._id, session);

    // 6. Create issue record
    const issueDate = new Date();
    const dueDate = calculateDueDate(issueDate);

    const issue = await Issue.create(
      [
        {
          userId,
          profileId,
          copyId: copy._id,
          issueDate,
          dueDate,
          status: "ISSUED",
          type: type.toUpperCase(),
        },
      ],
      { session },
    );

    // 7. Create delivery record for physical books
    if (type === "PHYSICAL") {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1); // Next day delivery

      await Delivery.create(
        [
          {
            issueId: issue[0]._id,
            branchId,
            userId,
            deliveryAddress: [activeAddress?.street, activeAddress?.city, activeAddress?.state, activeAddress?.pincode].filter(Boolean).join(', ') || 'Address not set',
            scheduledAt: scheduledDate,
            status: "SCHEDULED",
          },
        ],
        { session },
      );
    }

    await session.commitTransaction();

    return {
      issue: issue[0],
      message: "Book issued successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Return a book
 */
exports.returnBook = async (issueId) => {
  const issue = await Issue.findById(issueId);

  if (!issue) {
    throw new AppError("Issue record not found", 404);
  }

  if (issue.status === "RETURNED") {
    throw new AppError("Book already returned", 400);
  }

  // Mark as returned
  issue.returnDate = new Date();
  issue.status = "RETURNED";
  await issue.save();

  // Mark copy as available
  await inventoryService.markAsReturned(issue.copyId);

  // Update delivery status if physical
  if (issue.type === "PHYSICAL") {
    await Delivery.findOneAndUpdate(
      { issueId: issue._id },
      {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    );
  }

  return {
    issue,
    message: "Book returned successfully",
  };
};

/**
 * Get all issues
 */
exports.getAllIssues = async (filters = {}) => {
  const query = {};

  if (filters.status) {
    // If status is a comma separated string, convert to array
    if (filters.status.includes(",")) {
      query.status = { $in: filters.status.split(",") };
    } else {
      query.status = filters.status;
    }
  }

  const issues = await Issue.find(query)
    .populate({
      path: "copyId",
      populate: {
        path: "bookId branchId",
      },
    })
    .populate("userId")
    .sort("-issueDate");

  return issues;
};

/**
 * Get user issues
 */
exports.getUserIssues = async (userId, filters = {}) => {
  const query = { userId };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.profileId) {
    query.profileId = filters.profileId;
  }

  const issues = await Issue.find(query)
    .populate({
      path: "copyId",
      populate: {
        path: "bookId branchId",
      },
    })
    .sort("-issueDate");

  // Attach delivery status in a single batch query
  if (issues.length > 0) {
    const issueIds = issues.map((i) => i._id);
    const deliveries = await Delivery.find({ issueId: { $in: issueIds } })
      .select("issueId status scheduledAt deliveredAt")
      .lean();

    const deliveryMap = {};
    for (const d of deliveries) {
      deliveryMap[d.issueId.toString()] = d;
    }

    return issues.map((issue) => {
      const plain = issue.toObject();
      plain.delivery = deliveryMap[issue._id.toString()] || null;
      return plain;
    });
  }

  return issues;
};

/**
 * Get issue by ID with details
 */
exports.getIssueById = async (issueId) => {
  const issue = await Issue.findById(issueId)
    .populate({
      path: "copyId",
      populate: {
        path: "bookId branchId",
      },
    })
    .populate("userId");

  if (!issue) {
    throw new AppError("Issue record not found", 404);
  }

  // Get delivery details if physical
  let delivery = null;
  if (issue.type === "PHYSICAL") {
    delivery = await Delivery.findOne({ issueId: issue._id });
  }

  return {
    issue,
    delivery,
  };
};

/**
 * Get overdue issues (for penalty generation cron)
 */
exports.getOverdueIssues = async () => {
  const now = new Date();

  const overdueIssues = await Issue.find({
    status: "ISSUED",
    dueDate: { $lt: now },
  }).populate("userId");

  // Update status to OVERDUE
  for (const issue of overdueIssues) {
    issue.status = "OVERDUE";
    await issue.save();
  }

  return overdueIssues;
};

/**
 * Get issue history for a book (Librarian view)
 */
exports.getBookIssueHistory = async (bookId) => {
  const copies = await BookCopy.find({ bookId });
  const copyIds = copies.map((c) => c._id);

  const history = await Issue.find({
    copyId: { $in: copyIds },
  })
    .populate("userId")
    .populate("copyId")
    .sort("-issueDate");

  return history;
};
