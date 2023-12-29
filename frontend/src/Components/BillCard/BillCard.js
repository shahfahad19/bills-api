import axios from 'axios';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Spinner from '../Utils/Spinner';

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
            .catch((error) => { });
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
            <div className='flex-grow' >
                <div className='flex justify-between'>
                    <div className='flex flex-col justify-between space-y-1' onClick={viewBill}>
                        {!bill && <div className='text-center flex justify-center items-center'><Spinner /> <p className='px-2'>Loading</p></div>}
                        {bill && (
                            <>
                                <p className='text-primary font-semibold'>{bill.bill_name}</p>
                                <p className='text-sm'>{refNo}</p>

                                <p className='text-sm'>Due Date: {bill.due_date}</p>


                                {bill.remaining_days < 0 && <p className='text-error text-sm'></p>}
                                {bill.remaining_days >= 0 && <>
                                    {bill.remaining_days === 0 && <p className='text-error text-sm'>Last day of payment<br /> <span className='text-xs'>Late payment charges: Rs. {bill.after_due_bill.replaceAll(',', '') - bill.current_bill.replaceAll(',', '')} </span></p>
                                    }

                                    {bill.remaining_days === 1 && <p className='text-warning text-sm'>1 day left to pay<br /> <span className='text-xs'>Late payment charges: Rs. {bill.after_due_bill.replaceAll(',', '') - bill.current_bill.replaceAll(',', '')} </span></p>
                                    }

                                    {bill.remaining_days > 1 && bill.remaining_days <= 3 && <p className='text-warning text-sm'>{bill.remaining_days} days left to pay</p>
                                    }

                                    {bill.remaining_days > 3 && <p className='text-success text-sm'>{bill.remaining_days} days left to pay</p>
                                    }

                                </>}

                            </>
                        )}
                    </div>
                    {bill &&

                        <div className='flex flex-col justify-between space-y-1 text-right'>


                            <Link to={`/bill/${refNo}`} className='btn btn-xs btn-primary'>
                                View Bill
                            </Link>
                            {billType === 'pesco' && (
                                <p className='font-semibold text-secondary text-sm'>
                                    {bill.units} Units
                                </p>
                            )}
                            <p className='text-success font-bold'>Rs. {bill.current_bill}</p>


                        </div>
                    }
                </div>

            </div>
        </div>
    );
};

export default BillCard;
