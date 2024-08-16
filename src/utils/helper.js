import fs from "fs";

const removeFilesFromLocal = (localFilePath)=>{
    fs.unlinkSync(localFilePath+"");
}

export {removeFilesFromLocal}