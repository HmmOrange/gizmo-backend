import dynamoose from "dynamoose";
import { DynamoDB } from "@aws-sdk/client-dynamodb";

// Create the DynamoDB client manually (required in v4)
const ddb = new DynamoDB({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "debug",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "debug",
  },
});

// Attach client to Dynamoose
dynamoose.aws.ddb.set(ddb);    

export default dynamoose;
