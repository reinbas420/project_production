const XLSX = require('xlsx');
const path = require('path');

const data = [
  // 1. Valid ISBN - Should fetch successfully
  { ISBN: '9780439708180', Title: "Harry Potter and the Sorcerer's Stone", Quantity: 5, Condition: 'GOOD', Author: '', Genre: '', MinAge: '' },
  
  // 2. Valid ISBN - Should fetch successfully
  { ISBN: '9780261102354', Title: 'The Fellowship of the Ring', Quantity: 3, Condition: 'FAIR', Author: '', Genre: '', MinAge: '' },
  
  // 3. Valid ISBN - Should fetch successfully
  { ISBN: '9781451673319', Title: 'Fahrenheit 451', Quantity: 2, Condition: 'GOOD', Author: '', Genre: '', MinAge: '' },

  // 4. Missing ISBN - Should test Title fallback fetch successfully 
  { ISBN: '', Title: 'The Martian', Quantity: 4, Condition: 'NEW', Author: 'Andy Weir', Genre: 'Sci-Fi', MinAge: 13 },

  // 5. Missing both ISBN and Title - Should skip/error
  { ISBN: '', Title: '', Quantity: 1, Condition: 'GOOD', Author: 'Someone', Genre: 'Fantasy', MinAge: '' },

  // 6. Valid ISBN but invalid quantity - Should skip/error
  { ISBN: '9780451524935', Title: '1984', Quantity: 'abc', Condition: 'GOOD', Author: '', Genre: '', MinAge: '' },

  // 7. Valid ISBN but invalid condition - Should skip/error
  { ISBN: '9780061120084', Title: 'To Kill a Mockingbird', Quantity: 1, Condition: 'AMAZING', Author: '', Genre: '', MinAge: '' },

  // 8. Completely fake book with ISBN format - Should fail fetch and fallback to spreadsheet data
  { ISBN: '9780000000000', Title: 'The Greatest Fake Book Ever', Quantity: 1, Condition: 'POOR', Author: 'John Fake', Genre: 'Comedy', Summary: 'A very fake summary to pass validation.', MinAge: 10 }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Books");

// Output to Project Root
const outputPath = path.join(__dirname, '..', '..', 'test_bulk_import.xlsx');
XLSX.writeFile(wb, outputPath);

console.log('Saved to: ' + outputPath);
