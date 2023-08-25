import React from 'react';
import Header from './Main/Header';
import BillCardList from './BillCard/BillCardList';

const MainScreen = () => {
    return (
        <div>
            <Header />
            <BillCardList />
            <div className='h-14'></div>
        </div>
    );
};

export default MainScreen;
