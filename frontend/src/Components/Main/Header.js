import React from 'react';
import { Link } from 'react-router-dom';
import SearchBox from './SearchBox';

const Header = () => {
    return (
        <>
            <div className='navbar shadow-md mb-2.5'>
                <div className='navbar-start'>
                    <div className='navbar-item'>
                        <Link to='/' className='font-medium'>
                            <img src='./../../192.png' className='object-cover w-10' alt='' />
                        </Link>
                    </div>

                    <div className='navbar-end'>
                        <SearchBox />
                    </div>
                </div>
            </div>
        </>
    );
};

export default Header;
