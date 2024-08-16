import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { removeFilesFromLocal } from "../utils/helper.js";

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

export { 
    registerUser 
};