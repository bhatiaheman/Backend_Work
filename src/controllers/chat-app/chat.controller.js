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

const createGroupChat = asyncHandler(async (req,res) => {

    const {name, participants} = req.body;

    if(participants.includes(req.user._id.toString())) {
        throw new ApiError(400, "You can't add yourself to the group chat");
    }


    // Check for duplicates
    const members = [...new Set([...participants, req.user._id.toString()])];

    if(members.length < 3) {
        throw new ApiError(400, "Group chat should have atleast 3 members");
    }

    const groupChat = await Chat.create({
        name,
        isGroupChat: true,
        participants: members,
        admin: req.user._id,
    });

    const chat = await Chat.aggregate([
        {
            $match: {
                _id: groupChat._id,
            },
        },

        ...chatCommonAggregation(),
    ]);

    const payLoad = chat[0];

    if(!payLoad) {
        throw new ApiError(500, "Something went wrong");
    }

    payLoad?.participants?.forEach((participant) => {

        if(participant._id.toString() === req.user._id.toString()) return;

        emitSocketEvent(
            req,
            participant._id,
            ChatEventEnum.NEW_CHAT_EVENT,
            payLoad
        );
    });

    return res
    .status(200)
    .json(new ApiResponse(200, payLoad, "Group chat created successfully"));

});

const deleteGroupChat = asyncHandler(async (req,res) => {

    const { chatId } = req.params;


    // search for group chat
    const groupChat = await Chat.aggregate([
        {
            $match: {
                _id: new Mongoose.Types.ObjectId(chatId),
                isGroupChat: true,
            },
        },
        ...chatCommonAggregation(),
    ])

    const chat = groupChat[0];

    if(!chat) {
        throw new ApiError(404, "Group chat not found");
    }

    if(chat.admin?.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to delete this group chat, You are not Admin");
    }

    await Chat.findByIdAndDelete(chatId);

    // delete all messages and attachments associated to chat
    await deleteCascadeChatMessages(chatId);

    chat?.participants?.forEach((participant) => {

        if(participant._id.toString() === req.user._id.toString()) return;

        emitSocketEvent(
            req,
            participant._id,
            ChatEventEnum.DELETE_CHAT_EVENT,
            chat
        );
    });

    return res
    .status(200)
    .json(new ApiResponse(200, chat, "Group chat deleted successfully"));

});

const deleteOneOnOneChat = asyncHandler(async (req,res) => {

    const { chatId } = req.params;

    const chat = await Chat.aggregate([
        {
            $match: {
                _id: new Mongoose.Types.ObjectId(chatId),
                isGroupChat: false,
            },
        },
        ...chatCommonAggregation(),
    ])

    const payload = chat[0];

    if(!payload) {
        throw new ApiError(404, "Chat not found");
    }

    await Chat.findByIdAndDelete(chatId);

    await deleteCascadeChatMessages(chatId);

    const otherParticipant = payload?.participants?.find(
        (participant) => participant._id.toString() !== req.user._id.toString()
    );

    emitSocketEvent(
        req,
        otherParticipant._id?.toString(),
        ChatEventEnum.DELETE_CHAT_EVENT,
        payload
    )

    return res
    .status(200)
    .json(new ApiResponse(200, payload, "Chat deleted successfully"));

});

const leaveGroupChat = asyncHandler(async (req,res) => {

    const { chatId } = req.params;

    const groupChat = await Chat.findOne({
        _id: new Mongoose.Types.ObjectId(chatId),
        isGroupChat: true,
    });

    if(!groupChat) {
        throw new ApiError(404, "Group chat not found");
    }

    const existingParticipants = groupChat.participants;

    // check if the participant that is leaving the group is part of group
    if(!existingParticipants.includes(req.user?._id)) {
        throw new ApiError(403, "You are not a member of this group chat");
    }

    const updateGroup = await Chat.findByIdAndUpdate(
        chatId,
        {
            $pull: {
                participants: req.user?._id
            },
        },

        {new: true}
    );

    const chat = await Chat.aggregate([
        {
            $match: {
                _id: updateGroup._id,
            },
        },
        ...chatCommonAggregation(),
    ])

    const payload = chat[0];

    if(!payload) {
        throw new ApiError(500, "Something went wrong");
    };

    return res
    .status(200)
    .json(new ApiResponse(200, payload, "Group chat left successfully"));
});

const addNewParticipants = asyncHandler(async (req,res) => {

    const { chatId, participantId } = req.params;

    const groupChat = await Chat.findOne({
        _id: new Mongoose.Types.ObjectId(chatId),
        isGroupChat: true,
    });

    if(!groupChat) {
        throw new ApiError(404, "Group chat not found");
    }

    if(groupChat?.admin?.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to add participants, You are not Admin");
    }

    const existingParticipants = groupChat.participants;

    if(existingParticipants.includes(participantId)) {
        throw new ApiError(400, "Participant already exists");
    }

    const updatedChat = await Chat.findByIdAndUpdate(
        chatId,
        {
            $push: {
                participants: participantId,
            },
        },

        {new: true}
    )

    const chat = await Chat.aggregate([
        {
            $match: {
                _id: updatedChat._id,
            },
        },
        ...chatCommonAggregation(),
    ])

    const payload = chat[0];

    if(!payload) {
        throw new ApiError(500, "Something went wrong");
    }

    emitSocketEvent(req, participantId, ChatEventEnum.NEW_CHAT_EVENT, payload);

    return res
    .status(200)
    ,json(new ApiResponse(200, payload, "Participant added successfully"));
});

const removeParticipantsFromGroupChat = asyncHandler(async (req,res) => {

    const { chatId, participantId } = req.params;

    const groupChat = await Chat.findOne({
        _id: new Mongoose.Types.ObjectId(chatId),
        isGroupChat: true,
    });

    if(!groupChat) {
        throw new ApiError(404, "Group chat not found");
    }

    if(groupChat?.admin?.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to remove participants, You are not Admin");
    }

    const existingParticipants = groupChat.participants;

    if(!existingParticipants.includes(participantId)) {
        throw new ApiError(400, "Participant doesn't exists");
    }

    const updateChat = await Chat.findByIdAndUpdate(
        chatId,
        {
            $pull: {
                participants: participantId,
            },
        },

        {new: true}
    )

    const chat = await Chat.aggregate([
        {
            $match: {
                _id: updateChat._id,
            },
        },
        ...chatCommonAggregation(),
    ]);

    const payload = chat[0];

    if (!payload) {
        throw new ApiError(500, "Internal server error");
    }

    emitSocketEvent(req, participantId, ChatEventEnum.LEAVE_CHAT_EVENT, payload);

    return res
    .status(200)
    .json(new ApiResponse(200, payload, "Participant removed successfully"));
});

const getAllChats = asyncHandler(async (req,res) => {

    const chats = await Chat.aggregate([

        {
            $match: {
                participants: { $elemMatch: { $eq: req.user._id } },
            },
        },

        {
            $sort: {
                updatedAt: -1,
            },
        },

        ...chatCommonAggregation(),
    ])

});



export {

    createOrGetaOneOnOneChat,
    getGroupChatDetails,
    renameGroupChat,
    createGroupChat,
    deleteGroupChat,
    deleteOneOnOneChat,
    leaveGroupChat,
    addNewParticipants,
    removeParticipantsFromGroupChat,
    searchAvailableusers,
    getAllChats,

}