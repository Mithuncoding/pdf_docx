# Sample Files Directory

This directory should contain sample files for users to try in the Document Analyzer:

1. `sample-report.pdf` - A sample PDF report that demonstrates the document analysis features
2. `sample-image.jpg` - A sample image that demonstrates the image analysis features

When deploying this application, please add appropriate sample files to this directory to enable the "try a sample" functionality.

## Note for Development
If you're seeing the error about "browse file is not working", the issue has been fixed by:

1. Adding the missing `preventDefaults` function 
2. Improving the file input handling
3. Adding proper error handling for file processing
4. Adding file preview functionality

The application should now handle file browsing and uploading correctly. 