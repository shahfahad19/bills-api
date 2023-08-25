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
                        className='input input-solid-primary input-sm sm:input-md md:input-lg'
                        placeholder='Search...'
                        value={refNo}
                        onInput={refNoHandler}
                    />
                    <a className='btn btn-solid-primary btn-sm sm:btn-md md:btn-lg' href={`/search/${refNo}`}>
                        Search
                    </a>
                </div>
            </form>

            {alert.show && (
                <AlertModal type='error' text='Reference no. is invalid' handler={() => setAlert({ show: false })} />
            )}
        </>
    );
};

export default SearchBox;
