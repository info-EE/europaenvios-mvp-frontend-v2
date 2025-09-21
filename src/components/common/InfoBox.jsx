/* eslint-disable react/prop-types */
import React from "react";

export function InfoBox({title,value}){
    return (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-sm text-slate-600">{title}</div>
            <div className="text-2xl font-semibold text-slate-800">{value}</div>
        </div>
    )
};