import React from 'react';
import Modal from './Modal';

const SuccessModal = ({ isOpen, title = 'Success', message, onClose, onConfirm, confirmText = 'Great' }) => (
    <Modal
        isOpen={isOpen}
        type="success"
        title={title}
        message={message}
        onClose={onClose}
        onConfirm={onConfirm}
        confirmText={confirmText}
    />
);

export default SuccessModal;
