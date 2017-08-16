'use strict';

var DST_BUCKET = '';                                
var SRC_BUCKET = '';                                
var ACCESS_KEY = '';                       
var SECRET_KEY = '';   
var REGION_SRC = ''; 
var REGION_DST = ''; 

var ACCEPTED_EXTENTIONS = ["png", "jpg", "gif"];               

var WEBP_QUALITY = 10;

var AWS_SRC = require('aws-sdk');
var AWS_DEST = require('aws-sdk');
var path = require('path');
var fs = require('fs');
var webp=require('webp-converter');

AWS_SRC.config.region = REGION_SRC;
AWS_SRC.config.update({ accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY });

AWS_DEST.config.region = REGION_DST;
AWS_DEST.config.update({ accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY });

var s3_src = new AWS_SRC.S3();
var s3_dest = new AWS_DEST.S3();
var jpg_file="";
var webp_file="";

exports.handler = function (event, context) {

    var params = {
        Bucket: event.Records[0].s3.bucket.name,
        Key: event.Records[0].s3.object.key
    };

	jpg_file = path.basename(params.Key);
	webp_file = jpg_file.replace(path.extname(params.Key), '.webp');
	
    if (params.Bucket !== SRC_BUCKET) {
        context.done(null, 'Invalid bucket: ' + params.Bucket);
    }

    var accepted_extentions = ACCEPTED_EXTENTIONS.map(function (v) {
        return '.' + v + '$';
    });

    if (!params.Key.match(new RegExp(accepted_extentions.join('|')))) {
        context.done(null, 'It seems no image file: ' + params.Key);
    }

    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Received context:', JSON.stringify(context, null, 2));

    s3_src.getObject(params, function (error, data) {
        if (error) {
            context.fail('Error getting ' + params.Key + ' from ' + params.Bucket);
            context.done();
        }
		fs.writeFile("/tmp/"+jpg_file, data.Body, function(err) {
			if(err)
			{
				context.fail('Error Save File : '+"/tmp/"+jpg_file);
				context.done();
			}
			else
			{
				fs.exists("/tmp/"+jpg_file, (exists) => {
					if(!exists)
					{
						context.fail('Error Save File : '+"/tmp/"+jpg_file);
						context.done();
					}
					else
					{
						webp.cwebp("/tmp/"+jpg_file,"/tmp/"+webp_file,"-q "+WEBP_QUALITY,function(status){
							console.log("Webp Convert Status : "+status);
							fs.unlink("/tmp/"+jpg_file,function(err){
								if(err) return console.log("File Delete Error : "+err);
								console.log("file deleted successfully : /tmp/"+jpg_file);
							});  
							fs.exists("/tmp/"+webp_file, (exists) => {
								if(!exists)
								{
									context.fail('Error Convert File : '+"/tmp/"+jpg_file);
									context.done();
								}
								else
								{
									var fileStream = fs.createReadStream("/tmp/"+webp_file);
									var putParams = {
										Bucket: DST_BUCKET,
										Key: params.Key.replace(path.extname(params.Key), '.webp'),
										Body: fileStream
									};
									fileStream.on('end', function() {
										fs.unlink("/tmp/"+webp_file, function() {
											if(err) return console.log("File Delete Error : "+err);
											console.log("file deleted successfully : /tmp/"+webp_file);
										});
									});
									s3_dest.putObject(putParams, function(putErr, putData){
										if(putErr){
											context.fail('Error Upload File : '+"/tmp/"+webp_file);
											context.done();
										} else {
											console.log("Sucessfully Uploaded "+webp_file);
											context.succeed('data: ' + webp_file);
										}
									});
									
								}
							});
													
						});
					}
				});
			}
		});
    });
};