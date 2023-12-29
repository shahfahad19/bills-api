import React, { useState } from 'react';
import Wrapper from '../Utils/Wrapper';
import { SpinnerWithText } from '../Utils/Spinner';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { AlertModal } from '../Utils/Modal';

const SngplBillInfo = () => {
    const params = useParams();
    const refNo = params.refNo;
    const [billData, setBillData] = useState();
    const [error, setError] = useState();
    const [billAdded, setBillAdded] = useState(false);
    const [alert, setAlert] = useState({
        show: false,
    });

    useState(() => {
        setBillData();
        try {
            const bills = localStorage.getItem('bills') === null ? [] : JSON.parse(localStorage.getItem('bills'));
            setBillAdded(bills.includes(refNo));
        } catch (err) {
            console.log(err);
        }
        axios
            .get('https://billsapp.vercel.app/api/sngpl/' + refNo)
            .then((response) => {
                setBillData(response.data);
            })
            .catch((error) => {
                setError('Bill not found');
            });
    }, [refNo]);

    const addBill = () => {
        try {
            const bills = localStorage.getItem('bills') === null ? [] : JSON.parse(localStorage.getItem('bills'));
            bills.push(refNo);
            localStorage.setItem('bills', JSON.stringify(bills));
            setBillAdded(true);
            setAlert({
                show: true,
                text: 'Bill added successfully!',
            });
        } catch (err) {
            console.log('err', err);
        }
    };

    const deleteBill = () => {
        try {
            const bills = localStorage.getItem('bills') === null ? [] : JSON.parse(localStorage.getItem('bills'));

            const index = bills.indexOf(refNo);
            if (index !== -1) {
                bills.splice(index, 1);
            }

            localStorage.setItem('bills', JSON.stringify(bills));
            setBillAdded(false);
            setAlert({
                show: true,
                text: 'Bill deleted successfully!',
            });
        } catch (err) {
            console.log('err', err);
        }
    };

    return (
        <>
            <Wrapper>
                <div className='flex flex-col items-center mb-3'>
                    <h1 className='text-xl md:text-2xl font-semibold'>Bill Info</h1>
                </div>
                {!billData && !error && <SpinnerWithText>Please wait</SpinnerWithText>}
                {billData && (
                    <table className='table'>
                        <tbody>
                            <tr>
                                <th>Name: </th>
                                <td>{billData.bill_name}</td>
                            </tr>
                            <tr>
                                <th>Reference No: </th>
                                <td>{refNo}</td>
                            </tr>
                            <tr>
                                <th>Bill Month: </th>
                                <td>{billData.bill_month}</td>
                            </tr>
                            <tr>
                                <th>Reading Date: </th>
                                <td>{billData.reading_date}</td>
                            </tr>
                            <tr>
                                <th>Due Date: </th>
                                <td>{billData.due_date}</td>
                            </tr>
                            <tr>
                                <th>Days Remaining:</th>
                                <td> {billData.remaining_days < 0 && <p className='text-error text-sm'>Date exceeded</p>}
                                    {billData.remaining_days >= 0 && <>
                                        {billData.remaining_days === 0 && <p className='text-error text-sm'>Last day of payment</p>
                                        }

                                        {billData.remaining_days === 1 && <p className='text-warning text-sm'>1 day left to pay</p>
                                        }

                                        {billData.remaining_days > 1 && billData.remaining_days <= 3 && <p className='text-warning text-sm'>{billData.remaining_days} days left to pay</p>
                                        }

                                        {billData.remaining_days > 3 && <p className='text-success text-sm'>{billData.remaining_days} days left to pay</p>
                                        }

                                    </>}
                                </td>
                            </tr>
                            <tr>
                                <th>Bill Amount: </th>
                                <td>
                                    <span className='text-primary font-semibold'>Rs. {billData.current_bill}</span>
                                </td>
                            </tr>
                            <tr>
                                <th>After Due Date: </th>
                                <td>
                                    <span className='text-error font-semibold'>Rs. {billData.after_due_bill}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    {!billAdded ? (
                                        <button onClick={addBill} className='btn btn-block btn-success'>
                                            Add Bill
                                        </button>
                                    ) : (
                                        <button onClick={deleteBill} className='btn btn-block btn-error'>
                                            Delete Bill
                                        </button>
                                    )}
                                </td>
                                <td>
                                    <Link to={`/bill/${refNo}`} className='btn btn-block btn-secondary'>
                                        View Full Bill
                                    </Link>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}
                {error && <div className='flex justify-center items-center h-52'>{error}</div>}
            </Wrapper>
            {alert.show && (
                <AlertModal
                    type='success'
                    text={alert.text}
                    handler={() => {
                        setAlert({ show: false });
                    }}
                />
            )}

            <div className='h-14'></div>
        </>
    );
};

export default SngplBillInfo;
