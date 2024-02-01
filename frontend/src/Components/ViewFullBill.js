import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SpinnerWithText } from './Utils/Spinner';
import { Helmet } from 'react-helmet';

const ViewFullBill = () => {
    const params = useParams();
    const ref = params.refNo;

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            viewportMeta.remove();
        }

        return () => {
            const newViewportMeta = document.createElement('meta');
            newViewportMeta.name = 'viewport';
            newViewportMeta.content = 'width=device-width, initial-scale=1';
            document.head.appendChild(newViewportMeta);
        };
    }, []);

    const handleIframeLoad = () => {
        setIsLoading(false);
    };

    return (
        <>
            <div className='h-screen w-screen'>
                <div className='flex space-x-2 p-2'>
                    <a
                        className='btn btn-primary btn-xs'
                        href={`https://billsapp.vercel.app/api/bill/${ref}?res=download`}
                    >
                        Download Image
                    </a>
                    <a
                        className='btn btn-primary btn-xs'
                        href={`https://billsapp.vercel.app/api/bill/${ref}?res=download&file=pdf`}
                    >
                        Download PDF
                    </a>
                </div>
                {isLoading && (
                    <div className='flex items-center justify-center h-full'>
                        <SpinnerWithText>Please wait</SpinnerWithText>
                    </div>
                )}
                <iframe
                    title='bill'
                    className='h-full w-full'
                    src={`https://billsapp.vercel.app/api/bill/${ref}?res=bill`}
                    onLoad={handleIframeLoad}
                ></iframe>
            </div>
        </>
    );
};

export default ViewFullBill;
