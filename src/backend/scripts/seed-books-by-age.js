'use strict';

/**
 * seed-books-by-age.js
 *
 * Seeds 10 books for each of the 7 profile age groups with fully hardcoded
 * metadata — no external API calls, no rate limiting.
 *
 * ageRating format: "min-max"  →  the DB filter uses the min value to decide
 * visibility.  e.g. a child in ageGroup "8-10" gets childMaxAge = 8, so only
 * books with minAge ≤ 8 are shown.
 *
 * Target mapping:
 *   profile "0-3"   → ageRating "0-3"   (min=0)
 *   profile "4-6"   → ageRating "4-8"   (min=4)
 *   profile "6-8"   → ageRating "6-10"  (min=6)
 *   profile "8-10"  → ageRating "8-12"  (min=8)
 *   profile "10-12" → ageRating "10-14" (min=10)
 *   profile "12-15" → ageRating "12-18" (min=12)
 *   profile "15+"   → ageRating "14-99" (min=14)
 *
 * Safe to re-run: existing ISBNs are skipped.
 * Usage: node scripts/seed-books-by-age.js
 */

const mongoose      = require('mongoose');
const config        = require('../src/config');
const Book          = require('../src/models/Book');
const BookCopy      = require('../src/models/BookCopy');
const LibraryBranch = require('../src/models/LibraryBranch');

const COPIES_PER_BRANCH = 4;
const CONDITIONS        = ['GOOD', 'GOOD', 'GOOD', 'FAIR'];

// ─── All books, fully hardcoded ─────────────────────────────────────────────
const BOOKS = [

  // ══════════════════════════════════════════════════════════════════════════
  // AGE 0-3   (ageRating "0-3")
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: 'The Very Hungry Caterpillar',
    author: 'Eric Carle',
    isbn: '9780399226908',
    genre: ['Picture Book', 'Children'],
    ageRating: '0-3',
    summary: 'A caterpillar eats through a variety of foods before becoming a beautiful butterfly.',
    publishedDate: '1969',
  },
  {
    title: 'Goodnight Moon',
    author: 'Margaret Wise Brown',
    isbn: '9780064430173',
    genre: ['Picture Book', 'Children'],
    ageRating: '0-3',
    summary: 'A classic bedtime story where a little bunny says goodnight to everything in his room.',
    publishedDate: '1947',
  },
  {
    title: 'Brown Bear, Brown Bear, What Do You See?',
    author: 'Bill Martin Jr',
    isbn: '9780805002010',
    genre: ['Picture Book', 'Children'],
    ageRating: '0-3',
    summary: "A rhythmic, repetitive story where children see familiar animals in bright colours.",
    publishedDate: '1967',
  },
  {
    title: 'Where the Wild Things Are',
    author: 'Maurice Sendak',
    isbn: '9780064431781',
    genre: ['Picture Book', 'Fantasy', 'Children'],
    ageRating: '0-3',
    summary: 'Max is sent to bed without supper and imagines sailing to the land of the Wild Things.',
    publishedDate: '1963',
  },
  {
    title: 'The Snowy Day',
    author: 'Ezra Jack Keats',
    isbn: '9780140501827',
    genre: ['Picture Book', 'Children'],
    ageRating: '0-3',
    summary: 'A young boy named Peter explores his neighbourhood after the first big snowfall of winter.',
    publishedDate: '1962',
  },
  {
    title: 'Chicka Chicka Boom Boom',
    author: 'Bill Martin Jr',
    isbn: '9780671679491',
    genre: ['Picture Book', 'Children', 'Education'],
    ageRating: '0-3',
    summary: 'All the letters of the alphabet race up a coconut tree in this vibrant alphabet book.',
    publishedDate: '1989',
  },
  {
    title: 'If You Give a Mouse a Cookie',
    author: 'Laura Numeroff',
    isbn: '9780064431002',
    genre: ['Picture Book', 'Children'],
    ageRating: '0-3',
    summary: 'A humorous chain-reaction story about what happens when you give a mouse a cookie.',
    publishedDate: '1985',
  },
  {
    title: 'Goodnight Gorilla',
    author: 'Peggy Rathmann',
    isbn: '9780399230035',
    genre: ['Picture Book', 'Children'],
    ageRating: '0-3',
    summary: 'A sneaky gorilla follows a zookeeper home, releasing all the zoo animals along the way.',
    publishedDate: '1994',
  },
  {
    title: 'Guess How Much I Love You',
    author: 'Sam McBratney',
    isbn: '9781406311860',
    genre: ['Picture Book', 'Children'],
    ageRating: '0-3',
    summary: 'Big Nutbrown Hare and Little Nutbrown Hare try to measure how much they love each other.',
    publishedDate: '1994',
  },
  {
    title: 'The Very Busy Spider',
    author: 'Eric Carle',
    isbn: '9780399211669',
    genre: ['Picture Book', 'Children'],
    ageRating: '0-3',
    summary: 'A spider steadfastly keeps spinning her web despite constant distractions from farm animals.',
    publishedDate: '1984',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AGE 4-6   (ageRating "4-8")
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: 'The Cat in the Hat',
    author: 'Dr. Seuss',
    isbn: '9780394800011',
    genre: ['Picture Book', 'Children', 'Fantasy'],
    ageRating: '4-8',
    summary: 'Two bored children are visited by a tall anthropomorphic cat on a rainy day.',
    publishedDate: '1957',
  },
  {
    title: 'Green Eggs and Ham',
    author: 'Dr. Seuss',
    isbn: '9780394800168',
    genre: ['Picture Book', 'Children'],
    ageRating: '4-8',
    summary: 'Sam-I-Am persistently tries to convince a grumpy fellow to try green eggs and ham.',
    publishedDate: '1960',
  },
  {
    title: 'The Gruffalo',
    author: 'Julia Donaldson',
    isbn: '9780333710937',
    genre: ['Picture Book', 'Children', 'Fantasy'],
    ageRating: '4-8',
    summary: 'A clever mouse takes a walk through the deep dark wood and invents a monster called the Gruffalo.',
    publishedDate: '1999',
  },
  {
    title: 'Corduroy',
    author: 'Don Freeman',
    isbn: '9780399255830',
    genre: ['Picture Book', 'Children'],
    ageRating: '4-8',
    summary: 'A teddy bear in a department store longs to be adopted by a little girl who loves him.',
    publishedDate: '1968',
  },
  {
    title: 'Dragons Love Tacos',
    author: 'Adam Rubin',
    isbn: '9780803736801',
    genre: ['Picture Book', 'Children', 'Humour'],
    ageRating: '4-8',
    summary: 'A fun guide to what dragons love most — and what they absolutely cannot eat.',
    publishedDate: '2012',
  },
  {
    title: 'Curious George',
    author: 'H.A. Rey',
    isbn: '9780395150238',
    genre: ['Picture Book', 'Children', 'Adventure'],
    ageRating: '4-8',
    summary: 'A curious little monkey is brought from Africa to the city by the Man with the Yellow Hat.',
    publishedDate: '1941',
  },
  {
    title: 'Frog and Toad Are Friends',
    author: 'Arnold Lobel',
    isbn: '9780064440202',
    genre: ['Children', 'Fiction'],
    ageRating: '4-8',
    summary: 'Five warm and funny stories about Frog and Toad and the meaning of true friendship.',
    publishedDate: '1970',
  },
  {
    title: 'Pete the Cat: I Love My White Shoes',
    author: 'Eric Litwin',
    isbn: '9780062110671',
    genre: ['Picture Book', 'Children'],
    ageRating: '4-8',
    summary: 'Pete the Cat walks down the street singing about his brand new white shoes.',
    publishedDate: '2010',
  },
  {
    title: 'Alexander and the Terrible, Horrible, No Good, Very Bad Day',
    author: 'Judith Viorst',
    isbn: '9780689711732',
    genre: ['Picture Book', 'Children'],
    ageRating: '4-8',
    summary: 'Nothing goes right for Alexander, and he begins dreaming of moving to Australia.',
    publishedDate: '1972',
  },
  {
    title: 'The Very Lonely Firefly',
    author: 'Eric Carle',
    isbn: '9780399229695',
    genre: ['Picture Book', 'Children'],
    ageRating: '4-8',
    summary: 'A newly hatched firefly searches for others of its kind in this glowing picture book.',
    publishedDate: '1995',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AGE 6-8   (ageRating "6-10")
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: "Charlotte's Web",
    author: 'E.B. White',
    isbn: '9780061124952',
    genre: ['Fiction', 'Children', 'Fantasy'],
    ageRating: '6-10',
    summary: 'A pig named Wilbur finds a devoted friend in Charlotte, a spider who saves his life.',
    publishedDate: '1952',
  },
  {
    title: 'Magic Tree House: Dinosaurs Before Dark',
    author: 'Mary Pope Osborne',
    isbn: '9780679824114',
    genre: ['Fiction', 'Children', 'Adventure'],
    ageRating: '6-10',
    summary: 'Jack and Annie discover a magic tree house that transports them back to the age of dinosaurs.',
    publishedDate: '1992',
  },
  {
    title: 'Diary of a Wimpy Kid',
    author: 'Jeff Kinney',
    isbn: '9780810993136',
    genre: ['Fiction', 'Children', 'Humour'],
    ageRating: '6-10',
    summary: 'Greg Heffley chronicles his awkward middle-school experiences in hilarious cartoon diary form.',
    publishedDate: '2007',
  },
  {
    title: 'Captain Underpants: The First Epic Novel',
    author: 'Dav Pilkey',
    isbn: '9780590846288',
    genre: ['Fiction', 'Children', 'Humour'],
    ageRating: '6-10',
    summary: 'George and Harold hypnotise their strict principal into becoming the superhero Captain Underpants.',
    publishedDate: '1997',
  },
  {
    title: 'James and the Giant Peach',
    author: 'Roald Dahl',
    isbn: '9780142410363',
    genre: ['Fiction', 'Children', 'Fantasy'],
    ageRating: '6-10',
    summary: 'James escapes his dreadful aunts by travelling inside a giant peach with magical insects.',
    publishedDate: '1961',
  },
  {
    title: 'Charlie and the Chocolate Factory',
    author: 'Roald Dahl',
    isbn: '9780142410318',
    genre: ['Fiction', 'Children', 'Fantasy'],
    ageRating: '6-10',
    summary: 'Poor Charlie wins a golden ticket to tour Willy Wonka\'s incredible chocolate factory.',
    publishedDate: '1964',
  },
  {
    title: 'The BFG',
    author: 'Roald Dahl',
    isbn: '9780142410381',
    genre: ['Fiction', 'Children', 'Fantasy'],
    ageRating: '6-10',
    summary: 'Sophie is snatched from her bed by the Big Friendly Giant and taken to Giant Country.',
    publishedDate: '1982',
  },
  {
    title: 'Stuart Little',
    author: 'E.B. White',
    isbn: '9780064400565',
    genre: ['Fiction', 'Children', 'Adventure'],
    ageRating: '6-10',
    summary: 'Stuart Little, a mouse born to a human family, sets off on an adventure in New York City.',
    publishedDate: '1945',
  },
  {
    title: 'The Boxcar Children',
    author: 'Gertrude Chandler Warner',
    isbn: '9780807508527',
    genre: ['Fiction', 'Children', 'Mystery'],
    ageRating: '6-10',
    summary: 'Four orphaned children make their home in an old boxcar and solve local mysteries together.',
    publishedDate: '1924',
  },
  {
    title: 'Flat Stanley',
    author: 'Jeff Brown',
    isbn: '9780064420266',
    genre: ['Fiction', 'Children', 'Humour'],
    ageRating: '6-10',
    summary: 'After being flattened by a bulletin board, Stanley discovers the surprising advantages of being flat.',
    publishedDate: '1964',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AGE 8-10  (ageRating "8-12")
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: "Harry Potter and the Philosopher's Stone",
    author: 'J.K. Rowling',
    isbn: '9780439708180',
    genre: ['Fantasy', 'Fiction', 'Children'],
    ageRating: '8-12',
    summary: 'An orphaned boy discovers he is a wizard and begins school at Hogwarts School of Witchcraft and Wizardry.',
    publishedDate: '1997',
  },
  {
    title: 'The Lion, the Witch and the Wardrobe',
    author: 'C.S. Lewis',
    isbn: '9780064404990',
    genre: ['Fantasy', 'Fiction', 'Children'],
    ageRating: '8-12',
    summary: 'Four children step through a wardrobe into the magical world of Narnia, ruled by a White Witch.',
    publishedDate: '1950',
  },
  {
    title: 'Holes',
    author: 'Louis Sachar',
    isbn: '9780440414803',
    genre: ['Fiction', 'Children', 'Adventure'],
    ageRating: '8-12',
    summary: 'Stanley Yelnats is unjustly sent to a boys detention camp where inmates dig holes all day.',
    publishedDate: '1998',
  },
  {
    title: 'Bridge to Terabithia',
    author: 'Katherine Paterson',
    isbn: '9780064401845',
    genre: ['Fiction', 'Children'],
    ageRating: '8-12',
    summary: 'Jess and Leslie create an imaginary kingdom called Terabithia, where they are the rulers.',
    publishedDate: '1977',
  },
  {
    title: 'The Phantom Tollbooth',
    author: 'Norton Juster',
    isbn: '9780394820378',
    genre: ['Fiction', 'Children', 'Fantasy'],
    ageRating: '8-12',
    summary: 'A bored boy named Milo drives through a magical tollbooth into a land of wordplay and numbers.',
    publishedDate: '1961',
  },
  {
    title: 'Hatchet',
    author: 'Gary Paulsen',
    isbn: '9780689840920',
    genre: ['Fiction', 'Children', 'Adventure'],
    ageRating: '8-12',
    summary: 'After a plane crash, thirteen-year-old Brian must survive alone in the Canadian wilderness with only a hatchet.',
    publishedDate: '1987',
  },
  {
    title: 'Island of the Blue Dolphins',
    author: "Scott O'Dell",
    isbn: '9780547328614',
    genre: ['Fiction', 'Children', 'Historical'],
    ageRating: '8-12',
    summary: 'A young Native American girl survives alone on a Pacific island for many years after her tribe departs.',
    publishedDate: '1960',
  },
  {
    title: 'Tuck Everlasting',
    author: 'Natalie Babbitt',
    isbn: '9780312369811',
    genre: ['Fiction', 'Children', 'Fantasy'],
    ageRating: '8-12',
    summary: 'Ten-year-old Winnie Foster discovers the Tuck family has drunk from a spring that grants immortality.',
    publishedDate: '1975',
  },
  {
    title: 'The Secret Garden',
    author: 'Frances Hodgson Burnett',
    isbn: '9780064401883',
    genre: ['Fiction', 'Children', 'Classics'],
    ageRating: '8-12',
    summary: 'A young orphan discovers a hidden, neglected garden and brings it and her ailing cousin back to life.',
    publishedDate: '1911',
  },
  {
    title: 'Number the Stars',
    author: 'Lois Lowry',
    isbn: '9780440403272',
    genre: ['Fiction', 'Historical', 'Children'],
    ageRating: '8-12',
    summary: 'Ten-year-old Annemarie helps shelter her Jewish friend from the Nazis in occupied Denmark.',
    publishedDate: '1989',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AGE 10-12  (ageRating "10-14")
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: 'Percy Jackson and the Lightning Thief',
    author: 'Rick Riordan',
    isbn: '9780786838653',
    genre: ['Fantasy', 'Fiction', 'Adventure'],
    ageRating: '10-14',
    summary: 'Twelve-year-old Percy discovers he is the son of Poseidon and must prevent a war among the Greek gods.',
    publishedDate: '2005',
  },
  {
    title: 'Wonder',
    author: 'R.J. Palacio',
    isbn: '9780375869020',
    genre: ['Fiction', 'Children'],
    ageRating: '10-14',
    summary: 'Auggie Pullman, born with a facial difference, attends a mainstream school for the first time.',
    publishedDate: '2012',
  },
  {
    title: 'Coraline',
    author: 'Neil Gaiman',
    isbn: '9780380807345',
    genre: ['Fantasy', 'Fiction', 'Horror'],
    ageRating: '10-14',
    summary: 'Coraline discovers a secret door that leads to a parallel world that seems perfect — at first.',
    publishedDate: '2002',
  },
  {
    title: 'The Giver',
    author: 'Lois Lowry',
    isbn: '9780440237686',
    genre: ['Science Fiction', 'Dystopia', 'Fiction'],
    ageRating: '10-14',
    summary: 'In a seemingly perfect community, twelve-year-old Jonas is chosen to receive the memories of the past.',
    publishedDate: '1993',
  },
  {
    title: 'Little Women',
    author: 'Louisa May Alcott',
    isbn: '9780147514011',
    genre: ['Fiction', 'Classics', 'Historical'],
    ageRating: '10-14',
    summary: 'The story of four sisters — Meg, Jo, Beth, and Amy — growing up during the American Civil War.',
    publishedDate: '1868',
  },
  {
    title: 'Treasure Island',
    author: 'Robert Louis Stevenson',
    isbn: '9780141321004',
    genre: ['Fiction', 'Adventure', 'Classics'],
    ageRating: '10-14',
    summary: 'Young Jim Hawkins discovers a treasure map and sets sail on a dangerous adventure full of pirates.',
    publishedDate: '1883',
  },
  {
    title: 'A Wrinkle in Time',
    author: "Madeleine L'Engle",
    isbn: '9780312367541',
    genre: ['Fantasy', 'Science Fiction', 'Children'],
    ageRating: '10-14',
    summary: 'Meg Murry and her friends travel through time and space to rescue her father from an evil force.',
    publishedDate: '1962',
  },
  {
    title: 'The Call of the Wild',
    author: 'Jack London',
    isbn: '9780142410396',
    genre: ['Fiction', 'Adventure', 'Classics'],
    ageRating: '10-14',
    summary: 'Buck, a large dog, is stolen and taken to the Yukon where he must adapt to survive.',
    publishedDate: '1903',
  },
  {
    title: 'Swiss Family Robinson',
    author: 'Johann David Wyss',
    isbn: '9780140367409',
    genre: ['Fiction', 'Adventure', 'Classics'],
    ageRating: '10-14',
    summary: 'A shipwrecked family survives and thrives on a deserted tropical island by using their wits.',
    publishedDate: '1812',
  },
  {
    title: 'The Outsiders',
    author: 'S.E. Hinton',
    isbn: '9780142407332',
    genre: ['Fiction'],
    ageRating: '10-14',
    summary: 'Ponyboy Curtis navigates life in a divided society of greasers and Socs in 1960s Oklahoma.',
    publishedDate: '1967',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AGE 12-15  (ageRating "12-18")
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: 'The Maze Runner',
    author: 'James Dashner',
    isbn: '9780385737951',
    genre: ['Science Fiction', 'Dystopia', 'Fiction'],
    ageRating: '12-18',
    summary: 'Thomas wakes up in a lift with no memory and must navigate an ever-changing maze to survive.',
    publishedDate: '2009',
  },
  {
    title: 'Divergent',
    author: 'Veronica Roth',
    isbn: '9780062024039',
    genre: ['Science Fiction', 'Dystopia', 'Romance'],
    ageRating: '12-18',
    summary: 'In a dystopian Chicago, Beatrice must choose which faction she belongs to — and guard a dangerous secret.',
    publishedDate: '2011',
  },
  {
    title: 'The Fault in Our Stars',
    author: 'John Green',
    isbn: '9780525478812',
    genre: ['Fiction', 'Romance'],
    ageRating: '12-18',
    summary: 'Two teenage cancer patients fall in love and embark on a journey to meet a reclusive author.',
    publishedDate: '2012',
  },
  {
    title: 'Lord of the Flies',
    author: 'William Golding',
    isbn: '9780571191475',
    genre: ['Fiction', 'Classics'],
    ageRating: '12-18',
    summary: 'A group of British boys stranded on an uninhabited island gradually descend into savagery.',
    publishedDate: '1954',
  },
  {
    title: 'Fahrenheit 451',
    author: 'Ray Bradbury',
    isbn: '9781451673319',
    genre: ['Science Fiction', 'Dystopia', 'Fiction'],
    ageRating: '12-18',
    summary: 'In a future where books are outlawed and burned, fireman Guy Montag questions his role in society.',
    publishedDate: '1953',
  },
  {
    title: 'Brave New World',
    author: 'Aldous Huxley',
    isbn: '9780060850524',
    genre: ['Science Fiction', 'Dystopia', 'Fiction'],
    ageRating: '12-18',
    summary: 'A vision of a future world where human beings are engineered and conditioned for social stability.',
    publishedDate: '1932',
  },
  {
    title: 'Life of Pi',
    author: 'Yann Martel',
    isbn: '9780156027328',
    genre: ['Fiction', 'Adventure'],
    ageRating: '12-18',
    summary: 'Pi Patel survives 227 days adrift on the Pacific Ocean in a lifeboat with a Bengal tiger.',
    publishedDate: '2001',
  },
  {
    title: 'The Kite Runner',
    author: 'Khaled Hosseini',
    isbn: '9781594631931',
    genre: ['Fiction', 'Historical'],
    ageRating: '12-18',
    summary: 'The story of a friendship between two boys in Afghanistan and the guilt that haunts a betrayal.',
    publishedDate: '2003',
  },
  {
    title: 'Harry Potter and the Goblet of Fire',
    author: 'J.K. Rowling',
    isbn: '9780439139601',
    genre: ['Fantasy', 'Fiction', 'Adventure'],
    ageRating: '12-18',
    summary: 'Harry Potter is unexpectedly entered into the dangerous Triwizard Tournament in his fourth year at Hogwarts.',
    publishedDate: '2000',
  },
  {
    title: 'The House on Mango Street',
    author: 'Sandra Cisneros',
    isbn: '9780679734772',
    genre: ['Fiction'],
    ageRating: '12-18',
    summary: 'Esperanza Cordero grows up in the Latino section of Chicago, searching for her own identity and place.',
    publishedDate: '1984',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AGE 15+   (ageRating "14-99") — full adult view, still under 18+ filter
  // ══════════════════════════════════════════════════════════════════════════
  {
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    isbn: '9780141439518',
    genre: ['Fiction', 'Classics', 'Romance'],
    ageRating: '14-99',
    summary: 'The witty romantic tale of Elizabeth Bennet and the proud, wealthy Mr Darcy in Regency England.',
    publishedDate: '1813',
  },
  {
    title: 'Jane Eyre',
    author: 'Charlotte Bronte',
    isbn: '9780141441146',
    genre: ['Fiction', 'Classics', 'Romance'],
    ageRating: '14-99',
    summary: 'A passionate story of a governess who falls in love with the brooding Mr Rochester.',
    publishedDate: '1847',
  },
  {
    title: 'Frankenstein',
    author: 'Mary Shelley',
    isbn: '9780141439471',
    genre: ['Fiction', 'Classics', 'Horror', 'Science Fiction'],
    ageRating: '14-99',
    summary: 'Victor Frankenstein creates a sapient creature in an unorthodox experiment, with terrifying consequences.',
    publishedDate: '1818',
  },
  {
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    isbn: '9780141439570',
    genre: ['Fiction', 'Classics', 'Horror'],
    ageRating: '14-99',
    summary: 'A young man sells his soul for eternal youth while his portrait ages and grows ever more sinister.',
    publishedDate: '1890',
  },
  {
    title: 'One Hundred Years of Solitude',
    author: 'Gabriel Garcia Marquez',
    isbn: '9780060883287',
    genre: ['Fiction', 'Classics', 'Magical Realism'],
    ageRating: '14-99',
    summary: 'The multi-generational story of the Buendia family in the mythical Colombian town of Macondo.',
    publishedDate: '1967',
  },
  {
    title: 'Crime and Punishment',
    author: 'Fyodor Dostoevsky',
    isbn: '9780143058144',
    genre: ['Fiction', 'Classics', 'Mystery'],
    ageRating: '14-99',
    summary: 'A poverty-stricken student commits a murder and is consumed by overwhelming guilt and paranoia.',
    publishedDate: '1866',
  },
  {
    title: 'The Count of Monte Cristo',
    author: 'Alexandre Dumas',
    isbn: '9780140449266',
    genre: ['Fiction', 'Classics', 'Adventure', 'Mystery'],
    ageRating: '14-99',
    summary: 'A man wrongfully imprisoned escapes from jail and orchestrates an elaborate revenge against his enemies.',
    publishedDate: '1844',
  },
  {
    title: 'Moby-Dick',
    author: 'Herman Melville',
    isbn: '9780142437247',
    genre: ['Fiction', 'Classics', 'Adventure'],
    ageRating: '14-99',
    summary: 'Captain Ahab obsessively pursues the elusive white sperm whale that bit off his leg.',
    publishedDate: '1851',
  },
  {
    title: 'Anna Karenina',
    author: 'Leo Tolstoy',
    isbn: '9780143035008',
    genre: ['Fiction', 'Classics', 'Romance'],
    ageRating: '14-99',
    summary: 'A tragic story of love, infidelity and social convention in nineteenth-century Imperial Russia.',
    publishedDate: '1878',
  },
  {
    title: 'Don Quixote',
    author: 'Miguel de Cervantes',
    isbn: '9780142437230',
    genre: ['Fiction', 'Classics', 'Adventure', 'Humour'],
    ageRating: '14-99',
    summary: 'A middle-aged man becomes obsessed with chivalric romances and sets out to become a knight-errant.',
    publishedDate: '1605',
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────
const run = async () => {
  await mongoose.connect(config.mongodb.uri);
  console.log('✅ Connected to MongoDB\n');

  const branches = await LibraryBranch.find({ status: 'ACTIVE' }).lean();
  if (branches.length === 0) {
    console.error('❌ No active branches found. Run seed-iiith-branches.js first.');
    process.exit(1);
  }
  console.log(`🏛️  ${branches.length} branch(es): ${branches.map(b => b.name).join(', ')}\n`);

  let booksDone = 0, booksSkipped = 0, copiesCreated = 0;

  for (const bookData of BOOKS) {
    process.stdout.write(`📖 [${bookData.ageRating}] ${bookData.title} — `);

    const existing = await Book.findOne({ isbn: bookData.isbn });
    if (existing) {
      console.log('⏭️  already exists');
      booksSkipped++;
      continue;
    }

    let book;
    try {
      book = await Book.create({
        title:         bookData.title,
        author:        bookData.author,
        isbn:          bookData.isbn,
        genre:         bookData.genre,
        language:      bookData.language || 'English',
        summary:       bookData.summary,
        ageRating:     bookData.ageRating,
        publishedDate: bookData.publishedDate || undefined,
      });
    } catch (err) {
      console.log(`❌ create error — ${err.message}`);
      continue;
    }

    const copies = [];
    for (const branch of branches) {
      for (let i = 0; i < COPIES_PER_BRANCH; i++) {
        const barcode = `${branch.name.replace(/\s+/g,'').toUpperCase().slice(0,8)}-${book._id}-${i}`;
        copies.push({
          bookId:    book._id,
          branchId:  branch._id,
          barcode,
          status:    'AVAILABLE',
          condition: CONDITIONS[i % CONDITIONS.length],
        });
      }
    }

    try {
      await BookCopy.insertMany(copies);
      copiesCreated += copies.length;
      console.log(`✅  (${copies.length} copies across ${branches.length} branches)`);
    } catch (err) {
      console.log(`✅  book saved — ⚠️  copies error: ${err.message}`);
    }

    booksDone++;
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`📚  Books added:   ${booksDone}`);
  console.log(`⏭️   Books skipped: ${booksSkipped}`);
  console.log(`📦  Copies added:  ${copiesCreated}`);
  console.log('══════════════════════════════════════════\n');

  await mongoose.disconnect();
};

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
