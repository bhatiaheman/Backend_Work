import { Mongoose, Schema } from "mongoose";

const chatSchema = new Schema({

    users: {
        type: Mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    message: {
        type: String,
        required: true
    },

    date: {
        type: Date,
        default: Date.now
    },

    status: {
        type: String,
        enum: ['read', 'unread'],
        default: 'unread'
    },

    type: {
        type: String,
        enum: ['text', 'image', 'video', 'audio'],
        default: 'text'
    },

    


}, {timestamps: true})

export const Chat = Mongoose.model('Chat', chatSchema);