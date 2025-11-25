import dynamoose from "../db/dynamo.js";

const PasteSchema = new dynamoose.Schema(
    {
        slug: {
            type: String,
            hashKey: true,
        },
        title: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        hashedPassword: String,
        exposure: {
            type: String,
            enum: ["public", "password_protected", "unlisted", "private"],
            default: "public",
        },
        views: {
            type: Number,
            default: 0,
        },
        expiredAt: {
            type: Number,
            index: {
                type: "ttl",
                ttl: true,
            },
        },
        authorId: {
            type: String,
            index: {
                type: "global",
            },
        },
        bookmarks: {
            type: Number,
            default: 0,
        },
        dateDeleted: String,
    },
    {
        timestamps: true,
    }
);

export default dynamoose.model("Pastes", PasteSchema);
