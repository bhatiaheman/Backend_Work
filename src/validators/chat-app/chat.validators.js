import { body } from "express-validator";

const createAGroutChatValidator = () => {

    return [
        body('name').trim().notEmpty().withMessage('Group Name is required'),
        body('participants').isArray({min: 2, max: 300}).withMessage('Participants must be an array of at least 2 users')
    ]
}

const updateGroupChatNameValidator = () => {

    return [
        body('name').trim().notEmpty().withMessage('Group Name is required'),
    ]
}

export {createAGroutChatValidator, updateGroupChatNameValidator};