import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AppContext = React.createContext({
    navigate: {
        to: '',
    },
});

export const AppContextProvider = (props) => {
    const navigate = useNavigate();

    useEffect(() => {}, []);

    return (
        <AppContext.Provider
            value={{
                navigate,
            }}
        >
            {props.children}
        </AppContext.Provider>
    );
};

export default AppContext;
