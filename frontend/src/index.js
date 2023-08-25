import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import './index.css';
import Error from './Error';
import MainScreen from './Components/MainScreen';
import BillInfo from './Components/BillInfo';
import ViewFullBill from './Components/ViewFullBill';

const router = createBrowserRouter([
    {
        path: '/',
        element: <App />,
        errorElement: <Error />,
        children: [
            {
                path: '',
                element: <MainScreen />,
            },
            {
                path: 'search/:refNo',
                element: <BillInfo />,
            },
            {
                path: 'bill/:refNo',
                element: <ViewFullBill />,
            },
        ],
    },
]);

ReactDOM.createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
