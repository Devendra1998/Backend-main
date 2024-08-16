import { v2 as cloudinary } from 'cloudinary';
import { removeFilesFromLocal } from './helper.js';


// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View Credentials' below to copy your API secret
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) {
            return null;
        }
        // Upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{resource_type:"auto"});
        // File has been uploaded successfully
        // console.log('File is uploaded on Cloudinary',response.url);

        // Remove the locally saved file temporary file as upload operation got Succeed
        removeFilesFromLocal(localFilePath);
        return response
    } catch (error) {
        removeFilesFromLocal(localFilePath); // Remove the locally saved file temporary file as upload operation got failed
        return null;
    }
}

export {uploadOnCloudinary};