import Mongoose, {Schema} from 'mongoose';

const messageSchema = new Schema({

    sender: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },

    content: {
        type: String,
    },

    attachments: {
        type: [
        {
            url: String,
            localPath: String,
        },
        ],
        default: [],
    },

    chat: {
        type: Schema.Types.ObjectId,
        ref: "Chat",
    },

}, {timestamps: true})

export const Message = Mongoose.model('Message', messageSchema);