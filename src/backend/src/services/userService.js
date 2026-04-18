const User = require("../models/User");
const Auth = require("../models/Auth");
const Issue = require("../models/Issue");
const AppError = require("../utils/AppError");
const mongoose = require("mongoose");
const aiService = require("./aiService");

const serializePreferenceAnswer = (answer) => {
  if (Array.isArray(answer)) {
    return answer.filter(Boolean).join(", ");
  }
  if (answer == null) {
    return "";
  }
  return String(answer);
};

const normalizeProfilePreferences = (profileData = {}) => {
  if (Array.isArray(profileData.profilePreferences)) {
    return profileData.profilePreferences.map((item) => ({
      questionId: item.questionId,
      question: item.question,
      answer: Array.isArray(item.answer)
        ? item.answer.map((entry) => String(entry).trim()).filter(Boolean)
        : item.answer == null
          ? ""
          : String(item.answer).trim(),
    }));
  }

  const responses = profileData.questionnaireResponses || {};
  return Object.entries(responses).map(([questionId, answer]) => ({
    questionId,
    question: questionId,
    answer: Array.isArray(answer) ? answer : answer == null ? "" : String(answer),
  }));
};

const buildProfilePreferenceEmbeddingText = (profile = {}) => {
  const preferenceLines = (profile.profilePreferences || [])
    .map((pref) => {
      const question = pref.question || pref.questionId || "preference";
      const answer = serializePreferenceAnswer(pref.answer);
      return `${question}: ${answer}`;
    })
    .filter((line) => line.trim().length > 0);

  const genres = (profile.preferredGenres || []).join(", ");
  const languages = (profile.preferredLanguages || []).join(", ");

  return [
    `Profile name: ${profile.name || ""}`,
    `Age group: ${profile.ageGroup || ""}`,
    `Preferred genres: ${genres}`,
    `Preferred languages: ${languages}`,
    ...preferenceLines,
  ].join("\n");
};

const updateProfilePreferenceEmbedding = async (profile) => {
  const embeddingSource = buildProfilePreferenceEmbeddingText(profile);
  if (!embeddingSource.trim()) {
    profile.profilePreferencesEmbedding = undefined;
    profile.profilePreferencesEmbeddingDim = 0;
    profile.profilePreferencesEmbeddedAt = undefined;
    profile.profilePreferencesEmbeddingProvider = undefined;
    return;
  }

  try {
    const embedding = await aiService.generateProfileEmbedding(embeddingSource);
    if (Array.isArray(embedding) && embedding.length > 0) {
      profile.profilePreferencesEmbedding = embedding;
      profile.profilePreferencesEmbeddingDim = embedding.length;
      profile.profilePreferencesEmbeddedAt = new Date();
      profile.profilePreferencesEmbeddingProvider = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-2-preview";
    }
  } catch (error) {
    console.warn("[Profile Embedding] Could not update profile embedding:", error.message);
  }
};

/**
 * Get user by ID
 */
exports.getUserById = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

/**
 * Update user details
 */
exports.updateUser = async (userId, updateData) => {
  const allowedUpdates = ["phone", "deliveryAddress"];
  const updates = {};

  Object.keys(updateData).forEach((key) => {
    if (allowedUpdates.includes(key)) {
      updates[key] = updateData[key];
    }
  });

  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

/**
 * Create child profile
 */
exports.createChildProfile = async (parentId, profileData) => {
  const user = await User.findById(parentId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Profiles with ageGroup "15+" get the adult view (PARENT) but will have
  // a book-level filter applied on the frontend so they don't see 16+/18+ content.
  const accountType = profileData.ageGroup === '15+' ? 'PARENT' : 'CHILD';

  // Create new profile
  const newProfile = {
    profileId: new mongoose.Types.ObjectId(),
    name: profileData.name,
    accountType,
    ageGroup: profileData.ageGroup,
    preferredGenres: profileData.preferredGenres || [],
    preferredLanguages: profileData.preferredLanguages || [],
    questionnaireResponses: profileData.questionnaireResponses || {},
    profilePreferences: normalizeProfilePreferences(profileData),
    userprofileURL: profileData.userprofileURL || undefined,
  };

  user.profiles.push(newProfile);
  const createdProfile = user.profiles[user.profiles.length - 1];
  await updateProfilePreferenceEmbedding(createdProfile);
  await user.save();

  return newProfile;
};

/**
 * Get all child profiles
 */
exports.getChildProfiles = async (parentId) => {
  const user = await User.findById(parentId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const childProfiles = user.profiles.filter((p) => p.accountType === "CHILD");
  return childProfiles;
};

/**
 * Update profile
 */
exports.updateProfile = async (userId, profileId, updateData) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const profile = user.profiles.find(
    (p) => p.profileId.toString() === profileId.toString(),
  );

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  // Update allowed fields
  const allowedUpdates = [
    "name",
    "ageGroup",
    "preferredGenres",
    "preferredLanguages",
    "questionnaireResponses",
    "profilePreferences",
    "userprofileURL",
  ];
  let shouldRefreshEmbedding = false;
  Object.keys(updateData).forEach((key) => {
    if (allowedUpdates.includes(key)) {
      if (key === "questionnaireResponses") {
        const existingResponses = profile.questionnaireResponses || {};
        profile.questionnaireResponses = {
          ...existingResponses,
          ...updateData.questionnaireResponses,
        };
        shouldRefreshEmbedding = true;
      } else if (key === "profilePreferences") {
        profile.profilePreferences = normalizeProfilePreferences({
          profilePreferences: updateData.profilePreferences,
          questionnaireResponses: profile.questionnaireResponses,
        });
        shouldRefreshEmbedding = true;
      } else {
        profile[key] = updateData[key];
        if (
          key === "name" ||
          key === "ageGroup" ||
          key === "preferredGenres" ||
          key === "preferredLanguages"
        ) {
          shouldRefreshEmbedding = true;
        }
      }
    }
  });

  if (!profile.profilePreferences || profile.profilePreferences.length === 0) {
    profile.profilePreferences = normalizeProfilePreferences({
      questionnaireResponses: profile.questionnaireResponses || {},
    });
    shouldRefreshEmbedding = true;
  }

  if (shouldRefreshEmbedding) {
    await updateProfilePreferenceEmbedding(profile);
  }

  await user.save();
  return profile;
};

/**
 * Delete profile
 */
exports.deleteProfile = async (userId, profileId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Don't allow deleting the last parent profile
  const parentProfiles = user.profiles.filter(
    (p) => p.accountType === "PARENT",
  );
  const profileToDelete = user.profiles.find(
    (p) => p.profileId.toString() === profileId.toString(),
  );

  if (!profileToDelete) {
    throw new AppError("Profile not found", 404);
  }

  if (profileToDelete.accountType === "PARENT" && parentProfiles.length === 1) {
    throw new AppError("Cannot delete the last parent profile", 400);
  }

  user.profiles = user.profiles.filter(
    (p) => p.profileId.toString() !== profileId.toString(),
  );
  await user.save();

  return { message: "Profile deleted successfully" };
};

/**
 * Get profile reading history
 */
exports.getReadingHistory = async (userId, profileId) => {
  const user = await User.findById(userId).populate(
    "profiles.readingHistory.bookId",
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const profile = user.profiles.find(
    (p) => p.profileId.toString() === profileId.toString(),
  );

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  return profile.readingHistory;
};

/**
 * Add book to reading history
 */
exports.addToReadingHistory = async (userId, profileId, bookId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const profile = user.profiles.find(
    (p) => p.profileId.toString() === profileId.toString(),
  );

  if (!profile) {
    throw new AppError("Profile not found", 404);
  }

  profile.readingHistory.push({
    bookId,
    readAt: new Date(),
  });

  await user.save();
  return profile.readingHistory;
};

/**
 * Update user delivery location (GeoJSON Point)
 * Adds a new address to the deliveryAddresses array.
 * Also sets the legacy deliveryAddress field for backward compatibility.
 * Expects: { latitude, longitude, street, city, state, pincode, label }
 * Stores coordinates as [longitude, latitude] per MongoDB GeoJSON spec.
 */
exports.updateDeliveryLocation = async (userId, locationData) => {
  const { latitude, longitude, street, city, state, pincode, label } =
    locationData;

  if (latitude == null || longitude == null) {
    throw new AppError("Latitude and longitude are required", 400);
  }

  const addressObj = {
    label: label || "Home",
    street: street || "",
    city: city || "",
    state: state || "",
    pincode: pincode || "",
    location: {
      type: "Point",
      coordinates: [longitude, latitude], // MongoDB GeoJSON: [lng, lat]
    },
    isDefault: false,
  };

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // If this is the first address, make it default
  if (!user.deliveryAddresses || user.deliveryAddresses.length === 0) {
    addressObj.isDefault = true;
  }

  user.deliveryAddresses.push(addressObj);

  // Also update legacy single deliveryAddress field (always latest)
  user.deliveryAddress = {
    street: addressObj.street,
    city: addressObj.city,
    state: addressObj.state,
    pincode: addressObj.pincode,
    location: addressObj.location,
  };

  await user.save();
  return user;
};

/**
 * Get all delivery addresses for a user
 */
exports.getDeliveryAddresses = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user.deliveryAddresses || [];
};

/**
 * Delete a delivery address by its subdoc _id
 */
exports.deleteDeliveryAddress = async (userId, addressId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const idx = user.deliveryAddresses.findIndex(
    (a) => a._id.toString() === addressId,
  );
  if (idx === -1) {
    throw new AppError("Address not found", 404);
  }

  const wasDefault = user.deliveryAddresses[idx].isDefault;
  user.deliveryAddresses.splice(idx, 1);

  // If we deleted the default, make the first remaining address the default
  if (wasDefault && user.deliveryAddresses.length > 0) {
    user.deliveryAddresses[0].isDefault = true;
  }

  // Update legacy field
  const def = user.deliveryAddresses.find((a) => a.isDefault);
  if (def) {
    user.deliveryAddress = {
      street: def.street,
      city: def.city,
      state: def.state,
      pincode: def.pincode,
      location: def.location,
    };
  } else {
    user.deliveryAddress = undefined;
  }

  await user.save();
  return user.deliveryAddresses;
};

/**
 * Set a delivery address as default
 */
exports.setDefaultDeliveryAddress = async (userId, addressId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  let found = false;
  user.deliveryAddresses.forEach((a) => {
    if (a._id.toString() === addressId) {
      a.isDefault = true;
      found = true;
      // Update the legacy field
      user.deliveryAddress = {
        street: a.street,
        city: a.city,
        state: a.state,
        pincode: a.pincode,
        location: a.location,
      };
    } else {
      a.isDefault = false;
    }
  });

  if (!found) {
    throw new AppError("Address not found", 404);
  }

  await user.save();
  return user.deliveryAddresses;
};

/**
 * Check if a user is within delivery radius of a library branch
 * Uses MongoDB $near geospatial query.
 */
exports.isUserWithinDeliveryZone = async (
  userId,
  branchId,
  radiusMeters = 8000,
) => {
  const branch = await require("../models/LibraryBranch").findById(branchId);
  if (!branch || !branch.location || !branch.location.coordinates) {
    throw new AppError("Library branch location not configured", 400);
  }

  const eligible = await User.findOne({
    _id: userId,
    "deliveryAddress.location": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: branch.location.coordinates,
        },
        $maxDistance: radiusMeters,
      },
    },
  });

  return !!eligible;
};

/**
 * Delete an entire user account.
 * Blocked if the user has any active (ISSUED/OVERDUE) issues.
 */
exports.deleteAccount = async (userId) => {
  const activeIssues = await Issue.findOne({
    userId,
    status: { $in: ['ISSUED', 'OVERDUE'] },
  });

  if (activeIssues) {
    throw new AppError(
      'You have unreturned books. Please return all books before deleting your account.',
      400,
    );
  }

  await User.findByIdAndDelete(userId);
  await Auth.findOneAndDelete({ userId });

  return { message: 'Account deleted successfully' };
};
