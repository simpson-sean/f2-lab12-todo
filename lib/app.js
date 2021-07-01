const dotenv = require('dotenv').config();
const express = require('express');
const cors = require('cors');
const client = require('./client.js');
const app = express();
const morgan = require('morgan');
const ensureAuth = require('./auth/ensure-auth');
const createAuthRoutes = require('./auth/create-auth-routes');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev')); // http logging

const authRoutes = createAuthRoutes({
  selectUser(email) {
    return client.query(`
        SELECT id, email, hash
        FROM users
        WHERE email = $1;
    `, 
    [email]
    ).then(result => result.rows[0]);
  },

  insertUser(user, hash) {
    return client.query(`
          INSERT into users (email, hash)
          VALUES ($1, $2)
          RETURNING id, email;
    `,
    [user.email, hash]
    ).then(result => result.rows[0]);
  }
});


// setup authentication routes to give user an auth token
// creates a /auth/signin and a /auth/signup POST route. 
// each requires a POST body with a .email and a .password
app.use('/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// and now every request that has a token in the Authorization header will have a `req.userId` property for us to see who's talking
app.get('/api/test', (req, res) => {
  res.json({
    message: `in this proctected route, we get the user's id like so: ${req.userId}`
  });
});

// app.get('/', (req, res) => {
//   res.send('Hello World!')
// })

app.get('/api/todo', async(req, res) => {
  try {
    const data = await client.query('SELECT * from todo where owner_id=$1', [req.userId]);
    
    res.json(data.rows);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});



app.post('/api/todo', async (req, res) => {
  try {
    const data = await client.query(`
      INSERT INTO todo (task, severity, is_done, owner_id)
      VALUES ($1, $2, $3, $4)
    `, 
    [req.body.task, req.body.severity, req.body.is_done, req.userId]);

    res.json(data.rows);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  };
});


app.put('/api/todo/:id', async (req, res) => {
  try {
    const data = await client.query(`
          UPDATE todo
          SET is_done = true      
          WHERE id = $1
          AND owner_id = $2;
    `, [req.params.id, req.userId]);

    res.json(data.rows);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});



app.use(require('./middleware/error'));

module.exports = app;
