import { Outlet } from 'react-router-dom';
import { AppContextProvider } from './Components/Context/AppContext';

function App() {
    return (
        <AppContextProvider>
            <div className='h-screen'>
                <Outlet></Outlet>
            </div>
        </AppContextProvider>
    );
}

export default App;
