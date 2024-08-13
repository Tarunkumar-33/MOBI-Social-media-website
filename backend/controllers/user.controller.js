import bcrypt from "bcrypt.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import cloudinary from "../utils/cloudinary.js";

export const signUp=async(req,res)=>{
    try {
        const {username,email,password} = req.body;
        // check if something is missing
        if(!username || !email || !password)
        {
            return res.status(400).json({
                message:"Something is missing",
                success:false
            })
        }

        // check user is already exist or not
        const user = await User.findBy(email);
        if(user){
            return res.status(409).json({
                message: "User is already existed",
                success: false
            })
        }
        
        //hashedpassword before creating db
        const hashedpassword = await bcrypt(password,10);
        //create db
        await User.create({
            username: username,
            email: email,
            password: hashedpassword
        })

        return res.status(200).json({
            message:"SignUp Successfully",
            success: true
        })

    } catch (error) {
        console.log(error);
    }
}

// login mein bss 1.check(users db hashedpassword==(do hash of password from body))
//      2. create an obj userdetail -->which to return as res for "viewProfile"
// 3.create token and put in cookie to remain authentication(for particular period of time(like for 1 day)) in website
export const logIn=async(req,res)=>{
    try {
        // 1.check(users db hashedpassword==(do hash of password from body))
        const {email,password} = req.body;
        if(!email || !password)
        {
            return res.status(400).json({
                message:"Something is missing",
                success:false
            })
        }
        
        const hashing_body_password = await bcrypt.hash(password,10);
        const user = await User.findBy(email);
    
        if(hashing_body_password != user.password)
        {
            return res.status(404).json({
                message:"Invalid Credentials",
                success: false
            })
        }
        
        // 2. create an obj userdetail -->which to return as res for "viewProfile"
        const userDetail = {       // this is return in res
            _id:user._id,
            username:user.username,
            email:user.email,
            profilePicture:user.profilePicture,
            bio:user.bio,
            gender:user.gender,
            followers:user.followers,
            following:user.following,
            posts:user.posts
        }
     
        // 3.create token and put in cookie to remain authentication(for particular period of time(like for 1 day)) in website
        const token = await jwt.sign({userId: user._id},process.env.TOKEN_SEC_KEY,{expiresIn:"1d"});
        return res.cookie("token",token,{httpOnly:true, sameSite:"strict", maxAge:1*24*60*60*1000}).json({
            message: `Welcome back ${user.username}`,
            success: true,
            userDetail
        })
    } catch (error) {
        console.log(error);
    }

}


export const logOut=async(req,res)=>{
    try {
        return res.cookie("token","",{maxAge:0}).json({
            message:"Logout successfully",
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}

export const getProfile=async(req,res)=>{
    try {
        const userid = req.params.id;
        let user = await User.findById(userid);
        if(!user)
        {
            return res.status(404).json({
                message: "User not found",
                success:false
            })
        }
        return res.status(200).json({
            user,
            success:true
        })
    } catch (error) {
        console.log(error);
    }
}

export const editprofile=async(req,res)=>{
    try {
        // picking user(whom to edit is ourself) took id from token(which is in cookie)----using middleware
        const userid = req.id;
        const user = await User.findById(userid);
        if(!user)
        {
            return res.status(404).json({
                message:"User not found",
                success:false
            })
        }
        
        // credentials which we can edit 
        const {bio,gender} = req.body;
        const profilePicture = req.file;
        //editing profilePicture on cloud using cloudinary
          
          // 1. need to make uri of profilePicture 
          let cloudinary_response;
          if(profilePicture)
          {
            const file_uri = getDataUri(profilePicture);
            cloudinary_response = cloudinary.uploader.upload(file_uri);
          }

          // overwritten in db
          if(bio) user.bio = bio;
          if(gender) user.gender = gender;
          if(profilePicture) user.profilePicture = cloudinary_response.secure_url;
          
          await user.save();

          return res.status(200).json({
            message:"Profile updated",
            success:true,
            user
          })

    } catch (error) {
        console.log(error);
    }
}

export const getSuggestedUsers=async(req,res)=>{
  try {
     const suggestedUsers = await User.find({_id:{$ne:req.id}}).select("-password");
     if(!suggestedUsers){
        return res.status(400).json({
            message:"Currently do not have any users",
            success:false
        })
     }

     return res.status(200).json({
        success:true,
        users:suggestedUsers
    })
    
  } catch (error) {
    console.log(error);
  }
}

export const followORunfollow=async(req,res)=>{
    try {
        // extracting id's of both who and whom
        const who_follow_id = req.id;
        const whom_follow_id = req.params.id;
        if(who_follow_id==whom_follow_id)
        {
            return res.status(400).json({
                message: "You cannot follow/unfollow yourself",
                success:false
            })
        }

        // extracting dbs of both who and whom
        const who_follow_user = await User.findById(who_follow_id);
        const whom_follow_user = await User.findById(whom_follow_id);
        if(!who_follow_user || !whom_follow_user)
        {
            return res.status(404).json({
                message:"Invalid User",
                success:false
            })
        }

        //check already followed or not---who follow (user) ke dbs mein following mein whom follow ki id hai ke nhi ---T/F
        let isfollowing = who_follow_user.following.includes(whom_follow_id);
        if(isfollowing)
        {
            //hai --then we clicked for unfollow--so do unfollow
            await Promise.all([
                User.updateOne({_id:who_follow_id},{$pull:{following:whom_follow_id}}),
                User.updateOne({_id:whom_follow_id},{$pull:{followers:who_follow_id}})
            ])

            return res.status(200).json({
                message:"Unfollowed Successfully",
                success: true
            })
        }
        else{
            //nahi --then follow
            await Promise.all([
                User.updateOne({_id:who_follow_id},{$push:{following:whom_follow_id}}),
                User.updateOne({_id:whom_follow_id},{$push:{followers:who_follow_id}})
            ])

            return res.status(200).json({
                message:"followed successfully",
                success: true
            })
        }

        

    } catch (error) {
        console.log(error);
    }
}