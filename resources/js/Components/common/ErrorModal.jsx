import React from 'react';
import Modal from './Modal';

const ErrorModal = ({ isOpen, title = 'Something went wrong', message, onClose, confirmText = 'Okay' }) => (
    <Modal
        isOpen={isOpen}
        type="error"
        title={title}
        message={message}
        onClose={onClose}
        confirmText={confirmText}
    />
);

export default ErrorModal;
