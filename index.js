const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const port = process.env.Port || 5000;


// middleware

app.use(cors({
    origin:[
        'http://localhost:5173'
    ],
    credentials:true
}));
app.use(express.json());
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.cd6ahti.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// our middlewares
const logger = async(req, res , next) =>{
    console.log('log: info',req.method, req.host, req.url ,req.originalUrl)
    next();
}

const verifyToken = (req,res, next)=>{
    const token = req?.cookies?.token;
    // console.log('token in the middleware', token);
    // no token
    if(!token){
        return res.status(401).send({message: 'unauthorized access'})
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
            return res.status(401).send({massage: 'unauthorized access'})
        }
        req.user = decoded
        next();
    })

}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const serviceCollection = client.db('carDoctor').collection('services');
        const bookingCollection = client.db('carDoctor').collection('bookings');

        // auth api
        app.post('/jwt', async(req, res) =>{
            const user = req.body;
            console.log('user for toke', user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1hr'});
            res.cookie("token", token,{
                httpOnly: true,
                secure:true,
                sameSite:'none'
            })
            .send({success: true})
        })

        app.post('/logout',async(req,res)=>{
            const user = req.body;
            console.log('logging out', user);
            res.clearCookie('token', {maxAge:0}).send({success: true})
        })
        


        // services api
        app.get('/services',logger, async (req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = {
                projection: { service_id: 1, img: 1, title: 1, price: 1 }
            }
            const result = await serviceCollection.findOne(query, options);
            res.send(result)
        })

        // bookings

        app.get('/bookings',logger,verifyToken,async (req, res) => {
            // const booking = req.body;
            console.log(req.query.email);
            // console.log('Toke get' , req.cookies);
            console.log('user from valid token', req.user);
            if(req.user.email !== req.query.email){
                return res.status(403).send({massage: 'forbidden access'})
            }
            let query = {}
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await bookingCollection.find(query).toArray()
            res.send(result);
        })



        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingCollection.insertOne(booking)
            res.send(result);

        })

        app.patch('/bookings/:id', async (req, res) =>{
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)}
            const updateBooking = req.body;
            console.log(updateBooking);
            const updateDoc ={
                $set:{
                    status:updateBooking.status
                },
            };
            const result = await bookingCollection.updateOne(filter,updateDoc)
            res.send(result) 
             
        })

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('doctor is running')
})

app.listen(port, () => {
    console.log(`Car doctor is running on port ${port}`);
})