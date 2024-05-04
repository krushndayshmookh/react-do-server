require('dotenv').config()
const express = require('express')

const cors = require('cors')
const logger = require('morgan')
const jwt = require('jsonwebtoken')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGODB_URI)

const app = express()

app.use(cors())
app.use(logger('dev'))

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// mongoose

const User = mongoose.model('User', {
  username: String,
  password: String,
})

const Todo = mongoose.model('Todo', {
  text: String,
  isDone: Boolean,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
})

// middlewares

const validateToken = (req, res, next) => {
  const token = req.headers['authorization'].split(' ')[1]
  if (!token) {
    return res.status(401).send('Token is required')
  }
  jwt.verify(token, process.env.JWT_SECRET, (error, user) => {
    if (error) {
      return res.status(401).send('Token is invalid')
    }
    req.user = user
    next()
  })
}

// routes and controllers

app.get('/', (req, res) => {
  res.send('Hello from API!')
})

app.post('/auth/sign-up', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).send('Username and password are required')
  }
  User.create({ username, password })
    .then((user) => {
      delete user.password
      res.send(user)
    })
    .catch((error) => {
      res.status(400).send(error)
    })
})

app.post('/auth/sign-in', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).send('Username and password are required')
  }
  try {
    const user = await User.findOne({ username, password })

    if (!user) {
      return res.status(404).send('User not found')
    }

    const cleanUser = {
      _id: user._id,
      username: user.username,
    }
    const token = jwt.sign(cleanUser, process.env.JWT_SECRET)

    res.send({ token })
  } catch (error) {
    res.status(400).send(error)
  }
})

app.post('/todos', validateToken, async (req, res) => {
  const { text, isDone } = req.body
  if (!text) {
    return res.status(400).send('Text is required')
  }
  try {
    const todo = await Todo.create({
      text,
      isDone: isDone || false,
      user: req.user._id,
    })
    res.send(todo)
  } catch (error) {
    res.status(400).send(error)
  }
})

app.post('/todos-insecure', async (req, res) => {
  const { text, isDone } = req.body
  if (!text) {
    return res.status(400).send('Text is required')
  }
  try {
    const todo = await Todo.create({ text, isDone: isDone || false })
    res.send(todo)
  } catch (error) {
    res.status(400).send(error)
  }
})

app.get('/todos', async (req, res) => {
  try {
    const todos = await Todo.find()
      .populate({
        path: 'user',
        select: 'username',
      })
      .lean()
    res.send(todos)
  } catch (error) {
    res.status(400).send(error)
  }
})

app.get('/todos/:id', async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id)
    if (!todo) {
      return res.status(404).send('Todo not found')
    }
    res.send(todo)
  } catch (error) {
    res.status(400).send(error)
  }
})

app.put('/todos/:id', validateToken, async (req, res) => {
  const { text, isDone } = req.body
  try {
    const todo = await Todo.findById(req.params.id)
    if (!todo) {
      return res.status(404).send('Todo not found')
    }
    if (todo.user && todo.user.toString() !== req.user._id) {
      return res.status(401).send('Unauthorized')
    }
    todo.text = text || todo.text
    todo.isDone = isDone || todo.isDone
    await todo.save()
    res.send(todo)
  } catch (error) {
    res.status(400).send(error)
  }
})

app.delete('/todos/:id', validateToken, async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id)
    if (!todo) {
      return res.status(404).send('Todo not found')
    }
    if (todo.user && todo.user.toString() !== req.user._id) {
      return res.status(401).send('Unauthorized')
    }
    await todo.remove()
    res.send(todo)
  } catch (error) {
    res.status(400).send(error)
  }
})

app.delete('/admin/todos', async (req, res) => {
  try {
    await Todo.deleteMany()
    res.send('Todos deleted')
  } catch (error) {
    res.status(400).send(error)
  }
})

app.delete('/admin/users', async (req, res) => {
  try {
    await User.deleteMany()
    res.send('Users deleted')
  } catch (error) {
    res.status(400).send(error)
  }
})

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`)
})
