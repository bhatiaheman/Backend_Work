import fs from 'fs';


export const getRandomNumber = (max) => {
    return Math.floor(Math.random() * max);
};

export const getStaticFilePath = (req, filename) => {
    return `${req.protocol}://${req.get("host")}/images/${filename}`;
}

export const getLocalPath = (filename) => {
    return `public/images/${filename}`;
}

export const removeFile = (localPath) => {
    fs.unlink(localPath, (err) => {
        if(err) console.log("Error while removing local files", err);
        else {
            console.log("Local file removed", localPath);
        }
    })
}

export const removeUnusedMulterImageFilesOnError = (req) => {
    try {
        const multerFile = req.file;
        const multerFiles = req.files;
  
      if (multerFile) {
        
        removeFile(multerFile.path);
      }
  
      if (multerFiles) {
        /** @type {Express.Multer.File[][]}  */
        const filesValueArray = Object.values(multerFiles);
        
        filesValueArray.map((fileFields) => {
          fileFields.map((fileObject) => {
            removeLocalFile(fileObject.path);
          });
        });
      }
    } catch (error) {
      
      console.log("Error while removing image files: ", error);
    }
  };

