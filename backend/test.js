const express = require('express');
const app = express();
app.get('/', (req, res) => res.json({ message: 'JS Server OK' }));
app.listen(5001, () => console.log('JS Server live on 5001'));
