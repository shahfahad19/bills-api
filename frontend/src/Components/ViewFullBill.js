import React from 'react';
import { useParams } from 'react-router-dom';

const ViewFullBill = () => {
    const params = useParams();
    const ref = params.refNo;
    const billType = ref.length === 14 ? 'pesco' : 'sngpl';
    return (
        <>
            <div className='h-screen w-screen'>
                <iframe title='bill' className='h-full w-full' src={`/api/${billType}/${ref}?res=bill`}></iframe>
            </div>
        </>
    );
};

export default ViewFullBill;
