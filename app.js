import express from 'express'
import mongoose from 'mongoose'
import path from 'path'
import crypto  from 'crypto'
import bodyparser from 'body-parser'
import multer from 'multer'
import Grid from 'gridfs-stream'
import {GridFsStorage} from 'multer-gridfs-storage'
import session from 'express-session'
import passport from 'passport'
import passpolocal from 'passport-local'
import passportlocalmongoose from 'passport-local-mongoose'
import GoogleStrategy from'passport-google-oauth20';
import findOrCreate  from 'mongoose-findorcreate';
import fs from 'fs';
import { log } from 'console'
import { ReadStream, readSync } from 'fs'

var presentuser=null;

//import {userschema,User} from "./users.js"
const uridatabase ='mongodb+srv://ash:ash123ishere@cluster0.03apuea.mongodb.net/secretsDB'
//const uridatabase ="mongodb://127.0.0.1/secretsDB"
 

const conn=mongoose.createConnection(uridatabase)
//let gfs;
const app=express();
app.set('view engine','ejs');

app.use(bodyparser.urlencoded({extended:true}))
app.use(session({
    secret:"there is an secret",
    resave:false,
    saveUninitialized:false
}))
app.use(passport.initialize());
app.use(passport.session());
 

 const shareddata =new mongoose.Schema({
    owner:String,
    file_id:[]
 })

 

 const userschema=new mongoose.Schema({
     username: String,
     password: String,
     email:String,
     profile_pic:String
})
const usertodoc = new mongoose.Schema({
   username:String,
   file_id:[]
})
shareddata.plugin(findOrCreate);
const Shared=conn.model('Shared',shareddata);


usertodoc.plugin(findOrCreate);
const Udoc = conn.model('Udoc',usertodoc);

userschema.plugin(passportlocalmongoose);
userschema.plugin(findOrCreate);
 

const User= conn.model('User',userschema);
 
 
passport.use(User.createStrategy());


passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


passport.use(new GoogleStrategy({
  clientID:"56115212243-eihm1q03plt6mnrao0eraod1h0bl48rf.apps.googleusercontent.com",
  clientSecret:"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",
  callbackURL:"http://localhost:3000/auth/google/secrets",
  //userProfileURL:"https://www.googleleapis.com/oauth2/v3/usersinfo"
},
function(accessToken, refreshToken, profile, cb) {

  User.findOrCreate({ username: profile.id }, function (err, user) {
    if((user.username)!=null){
       
       Udoc.findOrCreate({username: user.username})
    }
    return cb(err, user);
  });

   


//   const newudoc = new Udoc({
//     username: presentuser,
//  })
//  newudoc.save();
  presentuser=profile.id
  //console.log("presetnuser  ",presentuser)
  
}
));

// conn.once('open',async()=>{
//     gfs = Grid(conn.db,mongoose.mongo);
//     gfs.collection('userfiles')
//   })


const promise = mongoose.connect(uridatabase, { useNewUrlParser: true });

let gfs, gridfsBucket;
conn.once('open', () => {
 gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
 bucketName: 'userfiles'
});

 gfs = Grid(conn.db, mongoose.mongo);
 gfs.collection('userfiles');
})


const storage = new GridFsStorage({
    url: uridatabase,
    db:promise,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'userfiles',
            metadata:{
               callname: file.originalname,
               review:""
            }
          };
          resolve(fileInfo);
        });
      });
    }
  });
  const upload = multer({ storage }); 

app.get('/',(req,res)=>{
    res.render('index')
})



app.get('/auth/google', passport.authenticate("google",{scope:["profile"]}))

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/upload');
  });


app.get('/secret',(req,res)=>{
     if(req.isAuthenticated()){
         res.render('secret')
     } else res.redirect('/');
})
app.get('/register',(req,res)=>{
     res.render('register',{err:null,givenname:null})
})
app.get('/login',(req,res)=>{
     res.render('login')
})

app.post("/register",upload.single("dp"),(req,res)=>{ 
    
  console.log("uploaded file : ", req.file)
  let nametemp=""
  if(req.file!=undefined) nametemp=req.file.filename;
  User.findOne({username:req.body.username}).then((user)=>{
     if(!user){
      User.register({username:req.body.username,email:req.body.email,profile_pic:(nametemp)},
        req.body.password,function(err,user){
            if(err) console.log(err);
             else {
              const newudoc = new Udoc({
                username: req.body.username,
             })
    
             newudoc.save();
             const  nshareitem = new Shared({
               owner: req.body.username
             })
             nshareitem.save();
    
                 passport.authenticate("local")(req,res,()=>{
                    presentuser=req.body.username;
                     res.redirect('/upload')
                 })
             }
             
        })
     }
      else {
        let err=1;
        res.render('register',{err:1,givenname:req.body.username});
        //res.redirect("/resister?error=" + encodeURIComponent('username already taken'))
      }
  })
   

})
app.get('/upload',(req,res)=>{
   
    if(req.isAuthenticated()){
        User.findOne({username:presentuser}).then((user)=>{
           res.render('upload',{dp:user.profile_pic})
        })
    } else res.redirect('/');
})

app.post('/login',(req,res)=>{
    
    var email
     

    if(req.body.username.trim()===""){
      res.redirect('/login')
    }
     
    else {
      User.findOne({username:req.body.username}).then((user)=>{
        if(!user) res.redirect('/register')
        else email=user.email
    }).catch(()=>{
         console.log(" there is an error ")
    })
    const newuser=User({
         username:req.body.username,
         email:email,
         password:req.body.password
    })

     req.login(newuser,function(err){
        if(err){
            console.log(err)
            res.redirect('/login')
        } else {
           passport.authenticate("local")(req,res,function(){
            presentuser=req.body.username;
            // console.log("user : " + presentuser)
             res.redirect('/upload')
           })
        }
     })
    }
})



app.post('/upload',upload.single("myfile"),async(req,res)=>{
    
    if(req.isAuthenticated()){
      if(req.file===undefined) {
        //console.log("hey aniket",req.file)
        res.redirect('/upload')
      }
    //      const file = gfs.chunks.find({_id:req.file.id })
    // .toArray((err, files) => {
    //   if (!files || files.length === 0) {
    //     return res.status(404).json({
    //       err: "no files exist"
    //     });
    //   }
    //   gfs.openDownloadStreamById(req.params.filename).pipe(res);
    // });
   // console.log(req)
        else {
          const newfile=(req.file.id).toString();
   



try{
  const doc = await Udoc.findOne({username:presentuser }).exec()
  //doc.file_id.push(newfile)
  doc.file_id.push({
     fid: newfile,
     review:req.body.review
  })
   await doc.save()
}
catch(err)
{
  console.log(err)
}

    //console.log(doc.file_id[0]);
    
// Update document
    res.redirect('/upload')

        }
    }
  
    else res.redirect('/'); 
    
})


app.get('/files',async(req,res)=>{
  var ar=[];
   var name;
   
   if(req.isAuthenticated()){
     let profilepic;
     User.findOne({username: presentuser}).then((user)=>{
        profilepic=user.profile_pic;
     })


      const info= await Udoc.findOne({username:presentuser}).then(async(file)=>{
           //console.log('present user', presentuser)
           if(file.file_id.length===0){
            //console.log("run")
            res.render("showcase",{files:[],dp:profilepic})
         }
           file.file_id.map((element)=>{ 
        
             let countitems=file.file_id.length;
             gfs.files.findOne({_id: new mongoose.Types.ObjectId(element.fid)})
               .then(async(files,err) =>{
                 
                    
                    if(files && (files.contentType ==='image/png' || files.contentType==='image/jpeg' || files.contentType==='image/jpg' )){

                      ar.push({
                         isImage: true,
                         filename: files.filename,
                         callname: files.metadata.callname,
                         reviews:element.review
                      })
                    
                    }  else {
                     
                      ar.push({
                        isImage: false,
                        filename: files.filename,
                        callname: files.metadata.callname,
                        reviews:element.review
                     })
                      
                    }   
                    if(ar.length===countitems){
                     
                      res.render('showcase',{files:ar,dp:profilepic})
                    }
                    
             });
            
           
           })

    })
  }
   
   else {
     res.redirect('/');
   }



    
   })
   app.get('/image/:filename',(req,res)=>{
     if(req.isAuthenticated()){
      gfs.files.findOne({filename: req.params.filename}).then((file,err)=>{
        if(!file || file.length===0){
          return res.status(404).json({
            err:'no image exit'
          }) }
         
        else {
          //console.log({file:file})
         const readStream = gridfsBucket.openDownloadStream(file._id);
         readStream.pipe(res);
        }
      })
     } 
     else {
       res.redirect('/login')
     }
 })


app.get('/show',(req,res)=>{
  if(req.isAuthenticated()){
    User.findOne({username:presentuser}).then((user)=>{
       res.render('showcase',{dp:user.profile_pic})
    })
    // res.render('showcase',{dp:})
  } else {
     res.render('index');
  }
})


app.get('/share',(req,res)=>{
   if(req.isAuthenticated()){
    User.findOne({username:presentuser}).then((user)=>{
      res.render('shareit',{dp:user.profile_pic})
   })
    //  res.render('shareit');
   }
    else {
       res.redirect('/login');
    }
})

app.post('/share',upload.single("sendit"),async(req,res)=>{
   
   if(req.file===undefined){
     res.redirect('/share')
   }
   else
    {
      const newfile=(req.file.id).toString();

  try{
    const doc = await Shared.findOne({owner:req.body.reciver }).exec()
    //doc.file_id.push(newfile)
    doc.file_id.push({
       fid: newfile,
       sender: presentuser,
       message:req.body.mess
    })
    
     await doc.save()
  }
  catch(err)
  {
    console.log(err)
  }
  
      //console.log(doc.file_id[0]);
      
  // Update document
      res.redirect('/share')
    }
  
     
})




app.get('/sharedfiles',async(req,res)=>{
  var ar=[];
   var name;
   
   if(req.isAuthenticated()){
     
     //console.log(" i am authenticated  ");
     let profilepic;
     User.findOne({username:presentuser}).then((user)=>{
      profilepic=user.profile_pic;
     })
      
     

      const info= await Shared.findOne({owner:presentuser}).then(async(file)=>{

         if(file.file_id.length===0){
          User.findOne({username:presentuser}).then((user)=>{
            res.render('sharedfiles',{files:[],dp:profilepic})
         })
            
         }
           file.file_id.map((element)=>{ 
        
             let countitems=file.file_id.length;
            
             gfs.files.findOne({_id: new mongoose.Types.ObjectId(element.fid)})
               .then(async(files,err) =>{
                 
                    
                    if(files && (files.contentType ==='image/png' || files.contentType==='image/jpeg' || files.contentType==='image/jpg' )){

                      ar.push({
                         isImage: true,
                         filename: files.filename,
                         callname: files.metadata.callname,
                         message:element.message,
                         sender: element.sender
                      })
                    
                    }  else {
                     
                      ar.push({
                        isImage: false,
                        filename: files.filename,
                        callname: files.metadata.callname,
                        message:element.message,
                        sender: element.sender
                     })
                      
                    }   
                    if(ar.length===countitems){
                     
                      res.render('sharedfiles',{files:ar,dp:profilepic})
                     // console.log("length of the file : ",files.length)
                    }
                    
             });
            
           
           })

    })
  }
   
   else {
     res.redirect('/');
   }



    
   })




   app.get('/download/:filename',(req,res)=>{
    if(req.isAuthenticated()){
    //  gfs.files.findOne({filename: req.params.filename}).then((file,err)=>{
    //    if(!file || file.length===0){
    //      return res.status(404).json({
    //        err:'no file exist'
    //      }) }
        
    //    else {
    //      //console.log({file:file})
    //     //const files= gridfsBucket.openDownloadStream(file._id);
    //     //res.download(files);

    //    }
    //  })

       
       //const files=gridfsBucket.openDownloadStreamByName(req.params.filename);.pipe(res);
       
    } 
    else {
      res.redirect('/login')
    }
})


app.get('/logout', function (req, res){
  req.session.destroy(function (err) {
    res.redirect('/');  
  });
});

app.get('/profile_pic',(req,res)=>{
    if(req.isAuthenticated()){
       res.render('profilepic')
    } else res.redirect('/login')
})


app.post('/profile_pic',upload.single("dp"),async(req,res)=>{
   if(req.isAuthenticated()){
          console.log(req.file)
          await  User.findOneAndUpdate({username:presentuser},{profile_pic:req.file.filename},{new:true})
               
      
      res.redirect('/upload')
   } else {
     res.redirect('/login')
   }
})



app.listen(3000,()=>{
     console.log("server is running.....")
     console.log('http://localhost:3000')
})




