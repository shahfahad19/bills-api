import React from 'react';

export const ModalWrapper = (props) => {
    return (
        <>
            <input className='modal-state' type='checkbox' defaultChecked={true} />
            <div className='modal'>
                <label className='modal-overlay'></label>
                <div className='modal-content flex flex-col gap-5'>{props.children}</div>
            </div>
        </>
    );
};

export const ModalCloseBtn = ({ handler }) => {
    return (
        <label onClick={handler} className='btn btn-sm btn-circle btn-ghost absolute right-2 top-2'>
            ✕
        </label>
    );
};

export const ModalTitle = ({ children }) => {
    return <h2 className='text-xl text-center font-medium'>{children}</h2>;
};

export const ModalButtons = (props) => {
    return <div className='flex gap-3'>{props.children}</div>;
};

// export const ModalContent = ({ children }) => {
//     return {children}</div>;
// };

export const ModalButton = ({ handler, className, children }) => {
    return (
        <label className={`btn btn-block ${className}`} onClick={handler}>
            {children}
        </label>
    );
};

export const ModalFormButton = ({ className, children }) => {
    return (
        <button type='submit' className={`btn btn-error btn-block ${className}`}>
            {children}
        </button>
    );
};

export const AlertModal = ({ type, text, handler }) => {
    return (
        <>
            <input className='modal-state' type='checkbox' defaultChecked={true} />
            <div className='modal'>
                <label className='modal-overlay'></label>
                <div className='modal-content flex flex-col gap-5'>
                    <div className='flex justify-center'>
                        {type === 'success' ? (
                            <svg
                                width='64'
                                height='64'
                                viewBox='0 0 48 48'
                                fill='none'
                                xmlns='http://www.w3.org/2000/svg'
                            >
                                <path
                                    fillRule='evenodd'
                                    clipRule='evenodd'
                                    d='M24 4C12.96 4 4 12.96 4 24C4 35.04 12.96 44 24 44C35.04 44 44 35.04 44 24C44 12.96 35.04 4 24 4ZM18.58 32.58L11.4 25.4C10.62 24.62 10.62 23.36 11.4 22.58C12.18 21.8 13.44 21.8 14.22 22.58L20 28.34L33.76 14.58C34.54 13.8 35.8 13.8 36.58 14.58C37.36 15.36 37.36 16.62 36.58 17.4L21.4 32.58C20.64 33.36 19.36 33.36 18.58 32.58Z'
                                    fill='#00BA34'
                                />
                            </svg>
                        ) : (
                            <svg
                                width='48'
                                height='48'
                                viewBox='0 0 48 48'
                                fill='none'
                                xmlns='http://www.w3.org/2000/svg'
                            >
                                <path
                                    fillRule='evenodd'
                                    clipRule='evenodd'
                                    d='M24 4C12.96 4 4 12.96 4 24C4 35.04 12.96 44 24 44C35.04 44 44 35.04 44 24C44 12.96 35.04 4 24 4ZM24 26C22.9 26 22 25.1 22 24V16C22 14.9 22.9 14 24 14C25.1 14 26 14.9 26 16V24C26 25.1 25.1 26 24 26ZM26 34H22V30H26V34Z'
                                    fill='#E92C2C'
                                />
                            </svg>
                        )}
                    </div>
                    <h2 className='text-lg text-center font-medium'>{text}</h2>

                    <div className='flex justify-center'>
                        <button className='btn btn-primary' onClick={handler}>
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
