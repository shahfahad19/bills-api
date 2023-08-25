import React, { useEffect, useState } from 'react';
import BillCard from './BillCard';

const BillCardList = () => {
    const [bills, setBills] = useState();
    useEffect(() => {
        try {
            let billsList = localStorage.getItem('bills') === null ? [] : JSON.parse(localStorage.getItem('bills'));
            setBills(billsList);
        } catch (err) {}
    }, []);

    return (
        <>
            {bills && (
                <>
                    {bills.map((bill, index) => {
                        return <BillCard key={index} refNo={bill} />;
                    })}
                </>
            )}
            {bills && bills.length === 0 && (
                <div className='text-error mt-48 mx-3 text-center'>No bills found. Search your bill to add!</div>
            )}
        </>
    );
};

export default BillCardList;
