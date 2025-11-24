import dynamoose from "../db/dynamo.js";

const FavouriteSchema = new dynamoose.Schema(
    {
        userId: { type: String, required: true, hashKey: true },
        objectId: { type: String, required: true, rangeKey: true },
        objectType: { type: String, enum: ["paste", "image"], required: true },
    },
    { timestamps: true }
);

export default dynamoose.model("Favourite", FavouriteSchema);
