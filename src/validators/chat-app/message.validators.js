import { body } from "express-validator";

const sendMessageValidator = () => {
    return [
        body('message').trim().notEmpty().optional().withMessage('Message is required'),
    ]
}

export {sendMessageValidator};