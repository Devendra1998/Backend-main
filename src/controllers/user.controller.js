import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { removeFilesFromLocal } from "../utils/helper.js";
import jwt from 'jsonwebtoken';

const options = {
    httpOnly : true,
    secure : true
}

const generateAccessAndRefreshToken = async (userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave : false });

        return {
            accessToken,
            refreshToken
        }

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req, res) => {

    // get user details from frontend
    // validation - non empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in DB
    // remove password and refresh token field from response
    // check for user creation
    // return response

    const {username,fullName,password,email} = req.body;
    if([username,fullName,password,email].some((field)=>field?.trim() === "")){
        throw new ApiError(400,"Please provide valid fields");
    }

    const existedUser = await  User.findOne({
        $or: [{ username },{ email }]
    })
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;

    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(existedUser){
        removeFilesFromLocal(avatarLocalPath);
        coverImageLocalPath && removeFilesFromLocal(coverImageLocalPath);
        throw new ApiError(409,"user with this username or email is already existed");
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar Image is needed")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500,"Avatar Image upload failed");
    }

    const user = await User.create(
        {
            fullName,
            avatar:avatar.url,
            coverImage:coverImage?.url || "",
            email,
            password,
            username:username.toLowerCase()
        }
    )

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500,"Something went wrong while registration");
    }
    
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered Successfully")
    )
})

const loginUser = asyncHandler(async (req,res)=>{
    // Retrieve data from req
    // check username or email are present
    // validate username or email with DB
    // password check
    // generate access token and refresh token
    // send cookie -> return acess token and refresh token

    const {username,email,password} = req.body;
    if(!(username || email)){
        throw new ApiError(400,"Email or username are required");
    }

    const user = await User.findOne({
        $or : [{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"User does not exits")
    }

    const isValidPassword = await user.isPasswordCorrect(password);
    if (!isValidPassword) {
        throw new ApiError(401,"User credentials are not valids")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id);

    // Optional we can update existing user object or can make another DB call
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user : loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfuly"
        )
    )

})

const logOutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(
            200,
            {},
            "User loggedOut Successfully"
        )
    )
})

const refreshAccessToken = asyncHandler(async (req,res) => {

   try {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) {
     throw new ApiError(401,"unauthorized request");
    }
 
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
 
    const user = await User.findById(decodedToken?._id);
 
    if (!user) {
     throw new ApiError(401,"Invalid Refresh Token");
    }
 
    if(incomingRefreshToken !== user?.refreshToken){
     throw new ApiError(401,"Refresh Token is used or expired");
    }
 
    const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id);
 
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json(
     new ApiResponse(
         200,
         {
             accessToken,
             refreshToken:newRefreshToken
         },
         "Access token refreshed successfuly"
     )
    )
   } catch (error) {
    throw new ApiError(401,error?.message || "Invalid refresh token");
   }
})

const changeUserPassword = asyncHandler(async (req,res) => {

    const {oldPassword,newPassword} = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400,"Incorrect old Password");
    }

    user.password = newPassword;

    const updatedUser = await user.save({validateBeforeSave:false});
    if (!updatedUser) {
        throw new ApiError(500,"Internal Error, Please try again");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Password Changed Successfully"
        )
    )
})

const getCurrentUser = asyncHandler(async (req,res) => {
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully");
})

const updateAccountDetails = asyncHandler(async (req,res)=>{

    const {fullName} = req.body;

    if (!fullName) {
        throw new ApiError(400,"All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName
            }
        },
        {new:true}
    ).select("-password")

    res.status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Account details updated successfuly"
        )
    )
})

const updateUserAvatar = asyncHandler( async (req,res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar image is missing");        
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(500,"Error while upload Avatar image");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-paasword")

    if (!user) {
        throw new ApiError(500,"Internal Error while image in database");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Avatar image updated Successfully"
        )
    )
})

const updateUserCoverImage = asyncHandler(async (req,res) => {

    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400,"CoverImage is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(500,"Error while uploading cover image,Please try again");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            coverImage:coverImage.url
        },
        {new:true}
    ).select("-password")

    if (!user) {
        throw new ApiError(500,"Internal Error while saving coverImage");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "CoverImage Updated Successfully"
        )
    )


})

export { 
    registerUser ,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeUserPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
};