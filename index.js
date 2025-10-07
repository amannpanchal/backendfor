const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const connectDb = async () => {
  try {
    await mongoose.connect('mongodb+srv://amanpanchal144:amanpanchal144@displayforce.igkk4.mongodb.net/?retryWrites=true&w=majority&appName=displayforce');
    console.log('Database connected successfully');
  } catch (e) {
    console.log('Error connecting to DB:', e.message);
  }
};
connectDb();

const schema = new mongoose.Schema({
  count: {
    type: Number,
    default: 0
  },
  time: [{
    type: Date,
    default: Date.now
  }]
}, { timestamps: true });

const Counter = mongoose.model('Counter', schema);

app.get('/product', async (req, res) => {
  try {
    let product = await Counter.findOne();
    if (!product) {
      product = new Counter();
      await product.save();
    }
    return res.json(product);
  } catch (e) {
    res.status(500).json({ message: 'Error fetching product', error: e.message });
  }
});

app.post('/product/increase', async (req, res) => {
  try {
    let product = await Counter.findOne();
    if (!product) {
      product = new Counter();
      await product.save();
    }
    product.count += 1;
    product.time.push(new Date());
    await product.save();
    res.json({
      message: 'Count increased successfully',
      count: product.count,
      totalIncreases: product.time.length,
      lastIncreasedAt: product.time[product.time.length - 1],
    });
  } catch (e) {
    res.status(500).json({ message: 'Error increasing product', error: e.message });
  }
});

app.listen(4000, () => {
  console.log('App is running at port 4000');
});
