import { Mongoose } from "mongoose";
import { ChatEventEnum } from "../../constants";
import { Chat } from "../../models/chat-app/chat.model";
import { Message } from "../../models/chat-app/message.model";
import { emitSocketEvent } from "../../socket/index.js";
import { ApiError } from "../../utils/ApiError.js";
import {  ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/AsyncHandler.js";


const chatMessageCommonAggregatioon = () => {

    return [
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
                        }
                    }
                ]
            }
        },

        {
            $addFields: {
                sender: { $first: "$sender"}
            },
        },
    ];
};


const getAllMessage = asyncHandler( async() => {

    
})