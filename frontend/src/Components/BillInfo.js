import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from './Main/Header';
import SearchBox from './Main/SearchBox';
import PescoBillInfo from './Pesco/PescoBillInfo';
import SngplBillInfo from './Sngpl/SngplBillInfo';
import { AlertModal } from './Utils/Modal';

const BillInfo = () => {
    const navigate = useNavigate();
    const params = useParams();
    const refNo = params.refNo;
    return (
        <>
            <Header />

            {refNo.length === 11 && <SngplBillInfo />}
            {refNo.length === 14 && <PescoBillInfo />}
            {refNo.length !== 11 && refNo.length !== 14 && (
                <AlertModal
                    type='error'
                    text='Reference no. is invalid'
                    handler={() => navigate(-1, { replace: true })}
                />
            )}
        </>
    );
};

export default BillInfo;
