import { faker} from "@faker-js/faker";
import { getRandomNumber } from "../src/utils/helpers.js";
import { User } from "../src/models/user.model.js";
import { Chat } from "../models/chat.model";
import { Message } from "../models/message.model";
import { ONE_ON_ONE_CHATS_COUNT } from "./_constans.seed.js";
import { asyncHandler } from "../src/utils/asyncHandler.js";
import { ApiResponse } from "../src/utils/ApiResponse.js";


const seedOneOnOneChats = async () => {

    const users = await User.find();
    const chatsArray = new Array(ONE_ON_ONE_CHATS_COUNT)
    .fill("_")
    .map(async (_) => {
        let index1 = getRandomNumber(users.length);
        let index2 = getRandomNumber(users.length);
        if (index1 === index2) {  
        index2 <= 0 ? index2++ : index2--; 
        }

        const participants = [
        users[index1]._id.toString(),
        users[index2]._id.toString(),
        ];

        await Chat.findOneAndUpdate(
        {
            $and: [
            {
                participants: {
                $elemMatch: { $eq: participants[0] },
                },
            },

            {
                participants: {
                $elemMatch: { $eq: participants[1] },
                },
            },
            ],
        },

        {
            $set: {
            name: "One on one chat",
            sGroupChat: false,
            participants,
            admin: participants[getRandomNumber(participants.length)],
            },
        },
        { upsert: true } 
        
        );
    });
    await Promise.all([...chatsArray]);
};


const groupChats = async() => {

    const users = await User.find();

    const groupChatsArray = new Array(GROUP_CHATS_COUNT).fill("_").map((_) => {
        let participants = [];
        const participantsCount = getRandomNumber(
        GROUP_CHAT_MAX_PARTICIPANTS_COUNT
        );
    
        new Array(participantsCount < 3 ? 3 : participantsCount)
        .fill("_")
        .forEach((_) =>
            participants.push(users[getRandomNumber(users.length)]._id.toString())
        );
    
        participants = [...new Set(participants)];
    
        return {
        name: faker.vehicle.vehicle() + faker.company.buzzNoun(),
        isGroupChat: true,
        participants,
        admin: participants[getRandomNumber(participants.length)],
        };
    });
    
    await Chat.insertMany(groupChatsArray);
    
}

const seedChatApp = asyncHandler(async () => {

    await Chat.deleteMany({});
    await Message.deleteMany({});
    await seedOneOnOneChats();
    await groupChats();

    return res.status(201).
    json(
        ApiResponse(
            
            201,
            {},
            "Database for chat app populated successfully",
            )
    )

});

export { seedChatApp};
  

