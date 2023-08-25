import React from 'react';

const Wrapper = ({ children }) => {
    return (
        <div className='mt-4 flex justify-center'>
            <div className='rounded shadow-md bg-backgroundSecondary p-3 w-11/12 md:w-8/12 lg:w-1/2'>{children}</div>
        </div>
    );
};

export default Wrapper;
