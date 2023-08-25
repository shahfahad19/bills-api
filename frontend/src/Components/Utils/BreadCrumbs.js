import React from 'react';
import { Link } from 'react-router-dom';

export const BreadCrumbs = (props) => {
    return (
        <div className='breadcrumbs text-sm bg-backgroundSecondary p-4 mb-2'>
            <ul>{props.children}</ul>
        </div>
    );
};

export const BreadCrumb = (props) => {
    return (
        <li>
            {props.to && <Link to={props.to}>{props.children}</Link>} {!props.to && props.children}
        </li>
    );
};
