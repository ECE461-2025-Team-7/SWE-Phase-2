//app/src/pipelines/DataPipeline.js
//This is the abstraction for our database till we integrate with a real one

//will import a database adapter here

class DataPipeline {
    async postData(data) {
        console.log("Uploaded Data: ", data);
    }
    async getData(query) {
        console.log("Here is the model data: ", query);
    }
}

export default DataPipeline;