import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BillCard = ({ refNo }) => {
    const navigate = useNavigate();
    const billType = refNo.length === 14 ? 'pesco' : 'sngpl';
    const [bill, setBill] = useState();

    useState(() => {
        axios
            .get(`https://billsapp.vercel.app/api/${billType}/${refNo}`)
            .then((response) => {
                setBill(response.data);
            })
            .catch((error) => {});
    }, [refNo]);

    const viewBill = () => {
        navigate('/search/' + refNo);
    };

    return (
        <div className='flex shadow-md m-2 my-4 p-2 rounded items-center'>
            <div className='w-20 mr-5' onClick={viewBill}>
                {billType === 'pesco' && (
                    <img alt='logo' src='https://bill.pitc.com.pk/images/companies/pesco/pescoLogo.png' />
                )}
                {billType === 'sngpl' && (
                    <img
                        alt='logo'
                        src='https://upload.wikimedia.org/wikipedia/en/thumb/9/99/SNGPL_logo.svg/250px-SNGPL_logo.svg.png'
                    />
                )}
            </div>
            <div className='flex-grow'>
                {!bill && <p>{refNo}</p>}
                {bill && (
                    <>
                        <div className='flex justify-between'>
                            <div onClick={viewBill}>
                                <p className='text-primary font-semibold'>{bill.bill_name}</p>
                                <p>Ref: {refNo}</p>
                            </div>
                            <div>
                                {billType === 'pesco' && (
                                    <p className='font-semibold text-secondary text-sm text-right'>
                                        {bill.units} Units
                                    </p>
                                )}
                                <a href={`/api/${billType}/${refNo}?res=bill`} className='btn btn-xs btn-primary'>
                                    View Bill
                                </a>
                            </div>
                        </div>

                        <div className='flex items-center justify-between'>
                            <p className='text-sm'>Due Date: {bill.due_date}</p>

                            <p className='text-success font-bold'>Rs. {bill.current_bill}</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BillCard;
