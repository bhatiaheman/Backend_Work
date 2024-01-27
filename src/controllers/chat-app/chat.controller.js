import { Mongoose } from "mongoose";
import { ChatEventEnum } from "../../constants.js";
import { User } from "../../models/user.model.js";
import { Chat } from "../../models/chat-app/chat.model.js";
import { Message } from "../../models/chat-app/chat.model.js";
import { emitSocketEvent } from "../../socket/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler} from "../../utils/asyncHandler.js";
import { removeFile } from "../../utils/helpers.js";

const chatCommonAggregation = () => {
    return [
        {
            $lookup: {
                from: "users",
                foreignField: "_id",
                localField: "participants",
                as: "participants",
                pipeline: [
                    {
                        $project: {
                            password: 0,
                            refreshToken: 0,
                        }
                    },
                ],
            },
        },


        // look for group chats
        {
            $lookup: {
                from: "messages",
                foreignField: "_id",
                localField: "lastMessage",
                as: "lastMessage",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            foreignField: "_id",
                            localField: "sender",
                            as: "sender",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        avatar: 1,
                                        email: 1
                                    },
                                },
                            ],
                        },
                    },

                    {
                        $addFields: {
                            sender: { $first : "$sender"},
                        },
                    },

                ],
            },
        },

        {
            $addFields: {
                lastMessage: { $first : "$lastMessage"},
            },
        },
    ];
};

const deleteCascadeChatMessages = async(chatId) => {
    // fetch messages associated to chat to remove
    // get attachemnts present in messages
    // delete all messages associated to chat

    const messages = await Message.find({
        chat: new Mongoose.Types.ObjectId(chatId)
    })

    let attachments = [];

    attachments = attachments.concat(
        ...messages.map((message) => {
            return message.attachments;
        })
    )

    attachments.forEach((attachment) => {
        removeFile(attachment.localPath);
    });

    await Message.deleteMany({
        chat : new Mongoose.Types.ObjectId(chatId),
    });
};

const searchAvailableusers = asyncHandler( async (req, res) => {
    const users = await User.aggregate([
        {
            $match: {
                _id: {
                    $ne: req.user._id,
                },
            },
        },

        {
            $project: {
                avatar: 1,
                username: 1,
                email: 1,
            },
        },
    ]);

    return res
    .status(200)
    .json( new ApiResponse(200, users, "Users Fetched Successfully"))
})

const createOrGetaOneOnOneChat = asyncHandler(async (req, res) => {
    // take the reciever id from params
    // find for the receiver in users
    // check if the reciever is not the user
    // avoid creating group chat and only logged in users can chat


    const { recievedId } = req.params;

    const reciever = await User.findById(recievedId);

    if(!reciever) {
        throw new ApiError(404, "User not found");
    }

    if(reciever._id.toString() === req.user._id.toString()) {
        throw new ApiError(404, "You can't chat with yourself");
    }

    const chat = await Chat.aggregate([

        {
            $match: {
                isGroupChat: false,

                $and: [
                    {
                        participants: { $elemMatch: { $eq: req.user._id }}
                    },

                    {
                        participants: {
                            $elemMatch: { $eq: new Mongoose.Types.ObjectId(recievedId) },
                        }
                    },
                ],
            },
        },

        ...chatCommonAggregation(),
    ])

    if (chat.length) {
        // if we find the chat that means user already has created a chat
        return res
            .status(200)
            .json(new ApiResponse(200, chat[0], "Chat retrieved successfully"));
    }

    const newChat = await Chat.create({
        isGroupChat: false,
        participants: [req.user._id, new Mongoose.Types.ObjectId(recievedId)],
        admin: req.user._id
    });

    const createdChat = await Chat.aggregate([
        {
            $match: {
                _id: newChat._id,
            },
        },

        ...chatCommonAggregation()
    ])

    const payload = newChat[0];

    if(!payload) {
        throw new ApiError(500, "Something went wrong");
    }

    payload?.participants?.forEach((participant) => {

        if(participant._id.toString() === req.user._id.toString()) return;

        emitSocketEvent(
            req,
            participant._id,
            ChatEventEnum.NEW_CHAT_EVENT,
            payload
        )
    })


    return res
    .status(200)
    .json(new ApiResponse(200, payload, "Chat Retrieved successfully"))

});


const getGroupChatDetails = asyncHandler(async (req,res) => {

    const {chatId} = req.params;

    const groupChatDetails = await Chat.aggregate([
        {
            $match: {
                _id: new Mongoose.Types.ObjectId(chatId),
                isGroupChat: true
            },
        },
        ...chatCommonAggregation(),
    ])

    const chat = groupChatDetails[0];

    if(!chat) {
        throw new ApiError(404, "Chat not found");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, chat, "Group chat fetched successfully"))
});

const renameGroupChat = asyncHandler(async (req,res) => {

    const { chatId} = req.params;
    const { name} = req.body;

    const groupChat = await Chat.find({
        _id: new Mongoose.Types.ObjectId(chatId),
        isGroupChat: true,
    });

    if(!groupChat) {
        throw new ApiError(404, "Group Chat not found");
    }

    if(groupChat.admin.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to rename this group chat, You are not Admin");
    }

    const updateGroupChat = await Chat.findByIdAndUpdate(
        chatId,
        {
            $set: {
                name,
            }
        },

        {new: true}
    );

    const chat = await Chat.aggregate([
        {
            $match: {
                _id: updateGroupChat._id,
            },
        },
        ...chatCommonAggregation(),
    ]);

    const payload = chat[0];

    if(!payload) {
        throw new ApiError(500, "Something went wrong");
    
    }

    payload?.participants?.forEach((participant) => {
        emitSocketEvent(
            req,
            participant._id?.toString(),
            ChatEventEnum.UPDATE_GROUP_NAME_EVENT,
            payload
        )
    })

    return res
    .status(200)
    .json(200, payload, "Group name updated successfully")

})





export {

    createOrGetaOneOnOneChat,
    getGroupChatDetails,
    renameGroupChat,


}