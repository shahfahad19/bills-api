import React from 'react';
import Header from '../Main/Header';

export default function Error404() {
    return (
        <>
            <div className='flex items-center justify-center h-80'>
                <div className='text-center'>
                    <p className='text-error font-bold'>
                        <span className='text-6xl'>404</span>
                        <br />
                        <span className='text-2xl'>Not Found</span>
                    </p>
                    <p className='font-semibold mt-5'>The resource you are looking for does not exist</p>
                </div>
            </div>
        </>
    );
}
