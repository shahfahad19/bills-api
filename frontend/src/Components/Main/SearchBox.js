import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertModal } from '../Utils/Modal';

const SearchBox = () => {
    const params = useParams();
    const [refNo, setRefNo] = useState(params.refNo ? params.refNo : '');

    const navigate = useNavigate();
    const [alert, setAlert] = useState({
        show: false,
    });

    const formSubmit = async (event) => {
        event.preventDefault();
        if (refNo.length === 14 || refNo.length === 11) navigate('/search/' + refNo);
        else
            setAlert({
                show: true,
            });
    };

    const refNoHandler = (event) => {
        const input = event.target.value;
        const numericValue = input.replace(/[^0-9]/g, '');
        setRefNo(numericValue);
    };

    return (
        <>
            <form onSubmit={formSubmit}>
                <div className='form-control'>
                    <input
                        className='input input-solid-primary input-sm sm:input-md rounded-md'
                        placeholder='Enter reference no.'
                        value={refNo}
                        onInput={refNoHandler}
                    />
                    <a className='btn btn-solid-primary btn-sm sm:btn-md rounded-md' href={`/search/${refNo}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style={{ fill: '#006adc', transform: '' }}><path d="M10 18a7.952 7.952 0 0 0 4.897-1.688l4.396 4.396 1.414-1.414-4.396-4.396A7.952 7.952 0 0 0 18 10c0-4.411-3.589-8-8-8s-8 3.589-8 8 3.589 8 8 8zm0-14c3.309 0 6 2.691 6 6s-2.691 6-6 6-6-2.691-6-6 2.691-6 6-6z"></path></svg>                    </a>
                </div>
            </form>

            {alert.show && (
                <AlertModal type='error' text='Reference no. is invalid' handler={() => setAlert({ show: false })} />
            )}
        </>
    );
};

export default SearchBox;
