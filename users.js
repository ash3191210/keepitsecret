import mongoose from 'mongoose'
mongoose.connect('mongodb://127.0.0.1/secretsDB')

export const userschema=new mongoose.Schema({
     username: String,
     password: String,
     email:String
})
export const User= new mongoose.model('User',userschema);
 
 
