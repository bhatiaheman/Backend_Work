import { Router } from "express";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import {addNewParticipants, createGroupChat, createOrGetaOneOnOneChat, deleteGroupChat, deleteOneOnOneChat, getAllChats, getGroupChatDetails, leaveGroupChat, removeParticipantsFromGroupChat, renameGroupChat, searchAvailableusers, } from "../../controllers/chat-app/chat.controller.js"
import { validate } from "express-validators";


const router = Router();

router.use(verifyJWT);

router.route("/").get(getAllChats);

router.route("/users").get(searchAvailableusers);

router
    .route("/c/:receiverId")
    .post(validate, createOrGetaOneOnOneChat)

router
    .route("/group")
    .post(createGroupChatValidator(), validate, createGroupChat)

router
    .route("/group/:chatId")
    .get(validate, getGroupChatDetails)
    .patch(validate, renameGroupChat)
    .delete(validate, deleteGroupChat)

router
    .route("/group/:chatId/:participantId")
    .post(validate, addNewParticipants)
    .delete(validate, removeParticipantsFromGroupChat)

router
    .route("/leave/group/:chatId")
    .delete(validate, leaveGroupChat)

router
    .route("/remove/:chatId")
    .delete(validate, deleteOneOnOneChat)


export default router;